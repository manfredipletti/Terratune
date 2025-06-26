from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from .config import Config
from flask_cors import CORS
import os

db = SQLAlchemy()
migrate = Migrate()
bcrypt = Bcrypt()
jwt = JWTManager()

def create_app(config_class=Config):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_folder = os.path.join(base_dir, 'frontend', 'dist')
    
    app = Flask(__name__, 
                static_folder=static_folder,  # Percorso assoluto per i file statici
                static_url_path='')
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    from app import models
    from app.api import bp as api_blueprint
    app.register_blueprint(api_blueprint, url_prefix='/api')

    if os.environ.get("FLASK_ENV") == "production":
        from flask import render_template, Response
        @app.route('/config.js')
        def config_js():
            token = os.environ.get("CESIUM_TOKEN", "")
            js = f'window.CESIUM_TOKEN = "{token}";'
            return Response(js, mimetype='application/javascript')
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve(path):
            if app.static_folder and path != "" and os.path.exists(os.path.join(app.static_folder, path)):
                return send_from_directory(app.static_folder, path)
            elif app.static_folder:
                return send_from_directory(app.static_folder, 'index.html')
            else:
                return "Static folder not found!", 404

    return app