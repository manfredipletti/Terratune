from sqlalchemy.testing.util import total_size

from app.models import User, Station, PlayHistory, Playlist
from app.api import bp
from app import db
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from .playlist import playlists_schema

from .stations import stations_schema, StationSchema, ma
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema


class PlayHistorySchema(SQLAlchemyAutoSchema):
    class Meta:
        model = PlayHistory
        include_fk = True
    station = ma.Nested(StationSchema)

play_history_schema = PlayHistorySchema(many=True)


@bp.route('/user/favorites', methods=['GET'])
@jwt_required()
def get_favorites():
    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)
    favorite_stations = user.favorite_stations.all()
    return jsonify(stations_schema.dump(favorite_stations))


@bp.route('/user/favorites', methods=['POST'])
@jwt_required()
def add_favorite():
    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)

    data = request.get_json()
    if not data or 'station_id' not in data:
        return jsonify({"error": "Missing station_id"}), 400

    station = Station.query.get_or_404(data['station_id'])

    if station in user.favorite_stations:
        return jsonify({"message": "Station already in favorites"}), 200

    user.favorite_stations.append(station)
    db.session.commit()
    return jsonify({"message": "Station added to favorites"}), 201


@bp.route('/user/favorites/<int:station_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(station_id):
    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)
    station = Station.query.get_or_404(station_id)

    if station not in user.favorite_stations:
        return jsonify({"error": "Station not in favorites"}), 400

    user.favorite_stations.remove(station)
    db.session.commit()
    return jsonify({"message": "Station removed from favorites"}), 200


@bp.route('/user/history', methods=['POST'])
@jwt_required()
def add_to_history():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    if not data or 'station_id' not in data:
        return jsonify({"error": "Missing station_id"}), 400

    station_id = data['station_id']
    if not Station.query.get(station_id):
        return jsonify({"error": "Station not found"}), 404

    history_entry = PlayHistory(user_id=current_user_id, station_id=station_id)
    db.session.add(history_entry)
    db.session.commit()
    return jsonify({"message": "Playback recorded"}), 201


@bp.route('/user/history', methods=['GET'])
@jwt_required()
def get_history():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)

    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)

    pagination = user.play_history.paginate(page=page, per_page=per_page, error_out=False)

    result = play_history_schema.dump(pagination.items)

    return jsonify({
        'items': result,
        'total_items': pagination.total,
        'total_pages': pagination.pages,
        'page': page,
        'per_page': per_page
    })

@bp.route('/user/playlists', methods=['GET'])
@jwt_required()
def get_my_playlists():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)
    pagination = (user.playlists.order_by(Playlist.created_at.desc())
                  .paginate(page=page, per_page=per_page, error_out=False))
    my_playlists = pagination.items
    return jsonify({
        "items" : playlists_schema.dump(my_playlists),
        "total_items": pagination.total,
        "total_pages": pagination.pages,
        "page": page,
        "per_page": per_page
    })

@bp.route('/user/followed_playlists', methods=['GET'])
@jwt_required()
def get_followed_playlists():
    current_user_id = get_jwt_identity()
    user = User.query.get_or_404(current_user_id)
    followed_playlists = user.followed_playlists.all()
    return jsonify(playlists_schema.dump(followed_playlists))