from app import db
from app.models import Playlist, Station, User
from app.api import bp
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from .stations import stations_schema, ma # Riusiamo gli schemi delle stazioni
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from marshmallow import fields

class PlaylistSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Playlist
        include_fk = True
        load_instance = True

    owner = fields.Nested(lambda: UserSchema(only=("username", "id")))
    stations = fields.Nested(stations_schema, many=True)
    follower_count = fields.Method("get_follower_count")

    def get_follower_count(self, obj):
        return obj.followers.count() if hasattr(obj.followers, 'count') else len(obj.followers)

class UserSchema(SQLAlchemyAutoSchema):
     class Meta:
        model = User

playlist_schema = PlaylistSchema()
playlists_schema = PlaylistSchema(many=True)


@bp.route('/playlists', methods=['POST'])
@jwt_required()
def create_playlist():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"error" : "Missing playlist name"}), 400
    name = data.get('name').strip()
    description = data.get('description', '').strip()
    is_public = data.get('is_public', True)

    if  not name:
        return jsonify({"error" : "Playlist name cannot be empty"}), 400

    new_playlist = Playlist(
        name=name,
        description=description,
        is_public=is_public,
        user_id=current_user_id
    )
    db.session.add(new_playlist)
    db.session.commit()
    return jsonify(playlist_schema.dump(new_playlist)), 201

@bp.route('/playlists', methods=['GET'])
def get_public_playlists():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    pagination = (Playlist.query.filter_by(is_public=True)
                  .order_by(Playlist.created_at.desc())
                  .paginate(page=page, per_page=per_page, error_out=False))
    public_playlists = pagination.items
    result = playlists_schema.dump(public_playlists)
    return jsonify({
        "items" : result,
        "total_items" : pagination.total,
        "total_pages" : pagination.pages,
        "page" : page,
        "per_page" : per_page
                   })


@jwt_required(optional=True)
@bp.route('/playlists/<int:playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    playlist = Playlist.query.get_or_404(playlist_id)

    if playlist.is_public:
        return jsonify(playlist_schema.dump(playlist))
    try:
        verify_jwt_in_request()
    except Exception as e:
        return jsonify({"error" : "Playlist not found"})

    current_user_id = get_jwt_identity()
    if playlist.user_id != current_user_id:
        return jsonify({"error" : "Playlist not found"})

    return jsonify(playlist_schema.dump(playlist))

@bp.route('/playlists/<int:playlist_id>', methods=['PUT'])
@jwt_required()
def update_playlist(playlist_id):
    playlist = Playlist.query.get_or_404(playlist_id)
    current_user_id = get_jwt_identity()
    if playlist.user_id != current_user_id:
        return jsonify({"error" : "Playlist not found"})
    data = request.get_json()
    if not data:
        return jsonify({"error" : "Missing playlist data"}), 400
    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({"error" : "Playlist name cannot be empty"}), 400
        playlist.name = name
    if "description" in data:
        playlist.description = data['description'].strip()
    if "is_public" in data:
        playlist.is_public = data['is_public']

    db.session.commit()
    return jsonify(playlist_schema.dump(playlist))


@bp.route('/playlists/<int:playlist_id>', methods=['DELETE'])
@jwt_required()
def delete_playlist(playlist_id):
    playlist = Playlist.query.get_or_404(playlist_id)
    current_user_id = get_jwt_identity()
    if playlist.user_id != current_user_id:
        return jsonify({"error" : "Playlist not found"}), 404
    db.session.delete(playlist)
    db.session.commit()
    return '', 204

@bp.route('/playlists/<int:playlist_id>/stations', methods=['POST'])
@jwt_required()
def add_station_to_playlist(playlist_id):
    playlist = Playlist.query.get_or_404(playlist_id)
    current_user_id = get_jwt_identity()
    if playlist.user_id != current_user_id:
        return jsonify({"error" : "Playlist not found"}), 404
    data = request.get_json()
    if not data or 'station_id' not in data:
        return jsonify({"error" : "Missing station_id in request body"}), 400
    station_id_to_add = data['station_id']
    station_to_add = Station.query.get_or_404(station_id_to_add)
    if station_to_add in playlist.stations:
        return jsonify({"message" : "Station already added"}), 400
    playlist.stations.append(station_to_add)
    db.session.commit()
    return jsonify({"message" : f"Stations '{station_to_add.name}' added to platlist '{playlist.name}'"}), 201

@bp.route('/playlists/<int:playlist_id>/stations/<int:station_id>', methods=['DELETE'])
@jwt_required()
def remove_station_from_playlist(playlist_id, station_id):
    playlist = Playlist.query.get_or_404(playlist_id)
    current_user_id = get_jwt_identity()
    if playlist.user_id != current_user_id:
        return jsonify({"error" : "Playlist not found"}), 404
    station_to_remove = Station.query.get_or_404(station_id)
    if station_to_remove not in playlist.stations:
        return jsonify({"error" : "Station not in this playlist"}), 400
    playlist.stations.remove(station_to_remove)
    db.session.commit()
    return jsonify({"message" : f"Station '{station_to_remove.name}' removed from playlist '{playlist.name}'"}), 200

@bp.route('/playlists/popular', methods=['GET'])
def get_popular_playlists():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    base_query = (
        db.session.query(
            Playlist,
            db.func.count(Playlist.followers.property.secondary.c.user_id).label('follower_count')
        )
        .select_from(Playlist)
        .outerjoin(Playlist.followers.property.secondary, Playlist.id == Playlist.followers.property.secondary.c.playlist_id)
        .filter(Playlist.is_public == True)
        .group_by(Playlist.id)
        .order_by(db.func.count(Playlist.followers.property.secondary.c.user_id).desc(), Playlist.created_at.desc())
    )
    total_items = base_query.count()
    results = base_query.offset((page - 1) * per_page).limit(per_page).all()
    playlists = []
    for playlist, follower_count in results:
        data = dict(playlist_schema.dump(playlist))
        data['follower_count'] = follower_count
        playlists.append(data)
    return jsonify({
        'items': playlists,
        'total_items': total_items,
        'total_pages': (total_items + per_page - 1) // per_page,
        'page': page,
        'per_page': per_page
    })

@bp.route('/playlists/<int:playlist_id>/follow', methods=['POST'])
@jwt_required()
def follow_playlist(playlist_id):
    current_user_id = get_jwt_identity()
    playlist = Playlist.query.get_or_404(playlist_id)
    user = User.query.get_or_404(current_user_id)
    if playlist in user.followed_playlists:
        return jsonify({'message': 'Already following'}), 200
    user.followed_playlists.append(playlist)
    db.session.commit()
    return jsonify({'message': 'Playlist followed'}), 201

@bp.route('/playlists/<int:playlist_id>/unfollow', methods=['POST'])
@jwt_required()
def unfollow_playlist(playlist_id):
    current_user_id = get_jwt_identity()
    playlist = Playlist.query.get_or_404(playlist_id)
    user = User.query.get_or_404(current_user_id)
    if playlist not in user.followed_playlists:
        return jsonify({'message': 'Not following'}), 200
    user.followed_playlists.remove(playlist)
    db.session.commit()
    return jsonify({'message': 'Playlist unfollowed'}), 200