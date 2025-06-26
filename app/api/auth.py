from flask import request, jsonify
from app.models import User
from app import db
from app.api import bp

from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity


@bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}

    if 'username' not in data or 'password' not in data:
        return jsonify({'error': 'must include username and password fields'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'username already exists'}), 400

    user = User()
    user.username = data['username']
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'User created successfully'}), 201


@bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    if 'username' not in data or 'password' not in data:
        return jsonify({'error': 'must include username and password fields'}), 400

    user = User.query.filter_by(username=data['username']).first()

    if user is None or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401  # Unauthorized

    access_token = create_access_token(identity=user.id)

    return jsonify(access_token=access_token)


@bp.route('/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user_id = get_jwt_identity()

    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_data = {
        "id": user.id,
        "username": user.username,
        "registered_since": user.created_at.isoformat()
    }

    return jsonify(user_data), 200