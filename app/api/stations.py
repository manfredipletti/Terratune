from app.models import Station, MusicGenre, Decade, Topic, Lang, Mood, user_favorites
from app.api import bp
from flask import request, jsonify
from flask_marshmallow import Marshmallow
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from marshmallow import fields
from sqlalchemy import func, case, and_
from app import db
from app.models import station_musicgenres, station_decades, station_topics, station_langs, station_moods
import math
import time
from collections import defaultdict

ma = Marshmallow(bp)


class MusicGenreSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = MusicGenre
        fields = ("name",)


class DecadeSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Decade
        fields = ("name",)


class TopicSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Topic
        fields = ("name",)


class LangSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Lang
        fields = ("name",)


class MoodSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Mood
        fields = ("name",)


class StationSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Station
        load_instance = True
        include_fk = True

    music_genres = fields.Nested(MusicGenreSchema, many=True)
    decades = fields.Nested(DecadeSchema, many=True)
    topics = fields.Nested(TopicSchema, many=True)
    langs = fields.Nested(LangSchema, many=True)
    moods = fields.Nested(MoodSchema, many=True)


station_schema = StationSchema()
stations_schema = StationSchema(many=True)


class StationMapSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Station
        fields = ("id", "name", "country", "favicon", "geo_lat", "geo_long", "url_resolved", "url")

station_map_schema = StationMapSchema()
stations_map_schema = StationMapSchema(many=True)


def calculate_cluster_threshold(zoom_level):
    factor = 4
    if zoom_level <= 5:
        return 0.8/factor
    elif zoom_level <= 7:
        return 0.3/factor
    elif zoom_level <= 9:
        return 0.1/factor
    elif zoom_level <= 11:
        return 0.02/factor
    elif zoom_level <= 13:
        return 0.005/factor
    elif zoom_level <= 15:
        return 0.001/factor
    elif zoom_level <= 17:
        return 0.0001/factor
    else:
        return 0.00001/factor


def create_clusters(stations, zoom_level):
    if not stations:
        return []
    
    threshold = calculate_cluster_threshold(zoom_level)
    clusters = []
    used_stations = set()
    
    for station in stations:
        if station.id in used_stations:
            continue
            
        if not station.geo_lat or not station.geo_long:
            continue
            
        nearby_stations = []
        for other_station in stations:
            if (other_station.id not in used_stations and 
                other_station.geo_lat and other_station.geo_long):
                
                lat_diff = abs(station.geo_lat - other_station.geo_lat)
                lng_diff = abs(station.geo_long - other_station.geo_long)
                
                if lat_diff <= threshold and lng_diff <= threshold:
                    nearby_stations.append(other_station)
                    used_stations.add(other_station.id)
        
        if len(nearby_stations) == 1:
            clusters.append({
                'type': 'station',
                'stations': [station]
            })
        else:
            avg_lat = sum(s.geo_lat for s in nearby_stations) / len(nearby_stations)
            avg_lng = sum(s.geo_long for s in nearby_stations) / len(nearby_stations)
            
            clusters.append({
                'id': f"cluster_{len(clusters)}",
                'type': 'cluster',
                'lat': avg_lat,
                'lng': avg_lng,
                'count': len(nearby_stations),
                'stations': nearby_stations
            })
    
    return clusters


def create_clusters_fast(stations, zoom_level):
    if not stations:
        return []

    threshold = calculate_cluster_threshold(zoom_level)
    grid = defaultdict(list)

    for station in stations:
        if not station.geo_lat or not station.geo_long:
            continue
        cell_x = int(station.geo_lat / threshold)
        cell_y = int(station.geo_long / threshold)
        grid[(cell_x, cell_y)].append(station)

    clusters = []
    for (cell_x, cell_y), group in grid.items():
        if len(group) == 1:
            clusters.append({
                'type': 'station',
                'stations': [group[0]]
            })
        else:
            avg_lat = sum(s.geo_lat for s in group) / len(group)
            avg_lng = sum(s.geo_long for s in group) / len(group)
            clusters.append({
                'id': f"cluster_{cell_x}_{cell_y}",
                'type': 'cluster',
                'lat': avg_lat,
                'lng': avg_lng,
                'count': len(group),
                'stations': group
            })
    return clusters


@bp.route('/stations/<int:station_id>', methods=['GET'])
def get_station(station_id):
    station = db.session.get(Station, station_id)
    if station is None:
        return jsonify({'error': 'Station not found'}), 404
    return jsonify(station_schema.dump(station))


@bp.route('/stations/clustered', methods=['GET'])
def get_clustered_stations():
    request_start_time = time.time()
    print("\n--- [CLUSTERING REQUEST START (Simple Algorithm)] ---")
    
    try:
        north = float(request.args.get('north', '90.0'))
        south = float(request.args.get('south', '-90.0'))
        east = float(request.args.get('east', '180.0'))
        west = float(request.args.get('west', '-180.0'))
        zoom = int(request.args.get('zoom', 10))
        print(f"Params: zoom={zoom}")
    except (TypeError, ValueError):
        return jsonify({'error': 'Missing or invalid bounding box parameters'}), 400


    query = Station.query.filter(
        Station.geo_lat.between(south, north),
        Station.geo_long.between(west, east),
        Station.geo_lat.isnot(None),
        Station.geo_long.isnot(None)
    ).order_by(Station.id)
    
    search_term = request.args.get('search')
    if search_term:
        query = query.filter(Station.name.ilike(f'%{search_term}%'))
    
    filter_map = {
        'genre': (station_musicgenres, MusicGenre),
        'decade': (station_decades, Decade),
        'topic': (station_topics, Topic),
        'lang': (station_langs, Lang),
        'mood': (station_moods, Mood)
    }
    
    for arg, (relationship, model) in filter_map.items():
        values_str = request.args.get(arg)
        if values_str:
            values = values_str.split(',')
            if arg == 'genre':
                assoc_table = station_musicgenres
            elif arg == 'decade':
                assoc_table = station_decades
            elif arg == 'topic':
                assoc_table = station_topics
            elif arg == 'lang':
                assoc_table = station_langs
            elif arg == 'mood':
                assoc_table = station_moods
            
            for value in values:
                subquery = db.session.query(assoc_table).join(model).filter(
                    assoc_table.c.station_id == Station.id,
                    model.name == value
                ).exists()
                query = query.filter(subquery)

    

    db_query_start = time.time()
    stations = query.all()
    db_query_time = time.time() - db_query_start
    print(f" -> DB query took: {db_query_time:.4f}s [Found {len(stations)} stations]")

    clustering_start = time.time()
    clustered_items = create_clusters_fast(stations, zoom)
    clustering_time = time.time() - clustering_start
    print(f" -> Clustering (fast) took: {clustering_time:.4f}s")
    
    serialization_start = time.time()
    response_items = []
    for item in clustered_items:
        if item['type'] == 'station':
            station_data = station_map_schema.dump(item['stations'][0])
            response_items.append({
                'type': 'station',
                'lat': station_data['geo_lat'],
                'lng': station_data['geo_long'],
                'count': 1,
                'stations': [station_data]
            })
        else:
            item['stations'] = stations_map_schema.dump(item['stations'])
            response_items.append(item)
    serialization_time = time.time() - serialization_start
    print(f" -> Serialization took: {serialization_time:.4f}s")

    response = jsonify({
        'items': response_items,
        'total_stations': len(stations),
        'zoom_level': zoom
    })

    request_time = time.time() - request_start_time
    print(f"--- [TOTAL REQUEST TIME: {request_time:.4f}s] ---\n")
    
    return response


@bp.route('/stations', methods=['GET'])
def get_stations():

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = Station.query

    search_term = request.args.get('search')
    if search_term:
        query = query.filter(Station.name.ilike(f'%{search_term}%'))

    filter_map = {
        'genre': (station_musicgenres, MusicGenre),
        'decade': (station_decades, Decade),
        'topic': (station_topics, Topic),
        'lang': (station_langs, Lang),
        'mood': (station_moods, Mood)
    }

    for arg, (relationship, model) in filter_map.items():
        if request.args.get(arg):
            values = request.args.get(arg).split(',')
            if arg == 'genre':
                assoc_table = station_musicgenres
            elif arg == 'decade':
                assoc_table = station_decades
            elif arg == 'topic':
                assoc_table = station_topics
            elif arg == 'lang':
                assoc_table = station_langs
            elif arg == 'mood':
                assoc_table = station_moods
            
            for value in values:
                subquery = db.session.query(assoc_table).join(model).filter(
                    assoc_table.c.station_id == Station.id,
                    model.name == value
                ).exists()
                query = query.filter(subquery)


    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    stations = pagination.items

    result = stations_schema.dump(stations)

    return jsonify({
        'items': result,
        'total_items': pagination.total,
        'total_pages': pagination.pages,
        'page': page,
        'per_page': per_page
    })


@bp.route('/stations/<int:station_id>/similar', methods=['GET'])
def get_similar_stations(station_id):
    limit = request.args.get('limit', 10, type=int)
    source_station = Station.query.get_or_404(station_id)

    source_genre_ids = {tag.id for tag in source_station.music_genres}
    source_decade_ids = {tag.id for tag in source_station.decades}
    source_topic_ids = {tag.id for tag in source_station.topics}
    source_lang_ids = {tag.id for tag in source_station.langs}
    source_mood_ids = {tag.id for tag in source_station.moods}

    if not any([source_genre_ids, source_decade_ids, source_topic_ids, source_lang_ids, source_mood_ids]):
        return jsonify([])

    score_expression = (
            func.sum(case((MusicGenre.id.in_(source_genre_ids), 5), else_=0)) +
            func.sum(case((Lang.id.in_(source_lang_ids), 4), else_=0)) +
            func.sum(case((Decade.id.in_(source_decade_ids), 3), else_=0)) +
            func.sum(case((Topic.id.in_(source_topic_ids), 2), else_=0)) +
            func.sum(case((Mood.id.in_(source_mood_ids), 1), else_=0))
    ).label("similarity_score")


    query = db.session.query(Station, score_expression) \
        .outerjoin(Station.music_genres) \
        .outerjoin(Station.decades) \
        .outerjoin(Station.topics) \
        .outerjoin(Station.langs) \
        .outerjoin(Station.moods) \
        .filter(Station.id != station_id) \
        .group_by(Station.id) \
        .having(score_expression > 0) \
        .order_by(score_expression.desc()) \
        .limit(limit)

    similar_stations = [station for station, score in query.all()]

    return jsonify(stations_schema.dump(similar_stations))


@bp.route('/stations/popular', methods=['GET'])
def get_popular_stations():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    base_query = (
        db.session.query(
            Station,
            func.count(user_favorites.c.user_id).label('favorite_count')
        )
        .outerjoin(user_favorites, Station.id == user_favorites.c.station_id)
        .group_by(Station.id)
        .order_by(func.count(user_favorites.c.user_id).desc())
    )

    total_items = base_query.count()
    results = base_query.offset((page - 1) * per_page).limit(per_page).all()

    stations = []
    for station, fav_count in results:
        data = station_schema.dump(station)
        data['favorite_count'] = fav_count
        stations.append(data)

    return jsonify({
        'items': stations,
        'total_items': total_items,
        'total_pages': (total_items + per_page - 1) // per_page,
        'page': page,
        'per_page': per_page
    })