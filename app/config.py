import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()


class Config:

    SECRET_KEY = os.environ.get('SECRET_KEY') or 'una-chiave-segreta-provvisoria'


    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)