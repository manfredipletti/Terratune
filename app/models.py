from . import db
from datetime import datetime
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()

station_musicgenres = db.Table('station_musicgenres',
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True),
    db.Column('musicgenre_id', db.Integer, db.ForeignKey('music_genre.id'), primary_key=True)
)

station_decades = db.Table('station_decades',
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True),
    db.Column('decade_id', db.Integer, db.ForeignKey('decade.id'), primary_key=True)
)

station_topics = db.Table('station_topics',
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True),
    db.Column('topic_id', db.Integer, db.ForeignKey('topic.id'), primary_key=True)
)

station_langs = db.Table('station_langs',
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True),
    db.Column('lang_id', db.Integer, db.ForeignKey('lang.id'), primary_key=True)
)

station_moods = db.Table('station_moods',
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True),
    db.Column('mood_id', db.Integer, db.ForeignKey('mood.id'), primary_key=True)
)

user_favorites = db.Table('user_favorites',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True)
)

playlist_station_association = db.Table('playlist_station',
    db.Column('playlist_id', db.Integer, db.ForeignKey('playlist.id'), primary_key=True),
    db.Column('station_id', db.Integer, db.ForeignKey('station.id'), primary_key=True)
)

playlist_followers = db.Table('playlist_followers',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('playlist_id', db.Integer, db.ForeignKey('playlist.id'), primary_key=True)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    favorite_stations = db.relationship('Station', secondary=user_favorites, lazy='dynamic')
    play_history = db.relationship('PlayHistory', backref='user', lazy='dynamic',
                                   order_by="desc(PlayHistory.played_at)")
    playlists = db.relationship('Playlist', backref='owner', lazy='dynamic')
    followed_playlists = db.relationship('Playlist', secondary=playlist_followers, back_populates='followers', lazy='dynamic')

    def set_password(self, password):
        """Crea l'hash della password."""
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        """Verifica la password confrontandola con l'hash."""
        return bcrypt.check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'


class Station(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False, index=True)
    url = db.Column(db.Text)
    url_resolved = db.Column(db.Text)
    homepage = db.Column(db.Text)
    favicon = db.Column(db.Text)
    country = db.Column(db.Text, index=True)
    countrycode = db.Column(db.String(10))
    state = db.Column(db.Text)
    codec = db.Column(db.String(20))
    bitrate = db.Column(db.Integer)
    geo_lat = db.Column(db.Float)
    geo_long = db.Column(db.Float)

    music_genres = db.relationship('MusicGenre', secondary=station_musicgenres, back_populates='stations')
    decades = db.relationship('Decade', secondary=station_decades, back_populates='stations')
    topics = db.relationship('Topic', secondary=station_topics, back_populates='stations')
    langs = db.relationship('Lang', secondary=station_langs, back_populates='stations')
    moods = db.relationship('Mood', secondary=station_moods, back_populates='stations')
    playlists = db.relationship('Playlist', secondary=playlist_station_association, back_populates='stations')



class MusicGenre(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    stations = db.relationship('Station', secondary=station_musicgenres, back_populates='music_genres')


class Decade(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    stations = db.relationship('Station', secondary=station_decades, back_populates='decades')


class Topic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    stations = db.relationship('Station', secondary=station_topics, back_populates='topics')


class Lang(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    stations = db.relationship('Station', secondary=station_langs, back_populates='langs')


class Mood(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    stations = db.relationship('Station', secondary=station_moods, back_populates='moods')


class PlayHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    station_id = db.Column(db.Integer, db.ForeignKey('station.id'), nullable=False)
    played_at = db.Column(db.DateTime, default=datetime.utcnow)
    station = db.relationship('Station')


class Playlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_public = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    stations = db.relationship('Station', secondary=playlist_station_association, lazy='dynamic')
    followers = db.relationship('User', secondary=playlist_followers, back_populates='followed_playlists', lazy='dynamic')

    def __repr__(self):
        return f'<Playlist {self.name}>'
