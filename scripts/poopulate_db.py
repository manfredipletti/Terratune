import csv
import json
from app import create_app, db
from app.models import Station, MusicGenre, Decade, Topic, Lang, Mood


def populate_database():
    app = create_app()
    with app.app_context():
        print("Avvio script di popolamento (con pulizia stringhe)...")

        print("Pulizia delle tabelle...")
        db.session.execute(db.text(
            'TRUNCATE TABLE station_musicgenres, station_decades, station_topics, station_langs, station_moods RESTART IDENTITY;'))
        db.session.execute(
            db.text('TRUNCATE TABLE station, "user", music_genre, decade, topic, lang, mood RESTART IDENTITY CASCADE;'))
        db.session.commit()
        print("Raccolta e pulizia dei tag unici dal file CSV...")
        all_genres, all_decades, all_topics, all_langs, all_moods = set(), set(), set(), set(), set()

        with open('scripts/stations_final.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('Music Genre'):
                    all_genres.update([tag.strip() for tag in row['Music Genre'].split(',') if tag.strip()])
                if row.get('Decade'):
                    all_decades.update([tag.strip() for tag in row['Decade'].split(',') if tag.strip()])
                if row.get('Topic'):
                    all_topics.update([tag.strip() for tag in row['Topic'].split(',') if tag.strip()])
                if row.get('Lang'):
                    all_langs.update([tag.strip() for tag in row['Lang'].split(',') if tag.strip()])
                if row.get('Mood'):
                    all_moods.update([tag.strip() for tag in row['Mood'].split(',') if tag.strip()])

        print("Popolamento delle tabelle di lookup...")
        genre_map = {name: MusicGenre(name=name) for name in all_genres}
        db.session.add_all(list(genre_map.values()))

        decade_map = {name: Decade(name=name) for name in all_decades}
        db.session.add_all(list(decade_map.values()))

        topic_map = {name: Topic(name=name) for name in all_topics}
        db.session.add_all(list(topic_map.values()))

        lang_map = {name: Lang(name=name) for name in all_langs}
        db.session.add_all(list(lang_map.values()))

        mood_map = {name: Mood(name=name) for name in all_moods}
        db.session.add_all(list(mood_map.values()))

        db.session.commit()
        print("Tabelle di lookup popolate con successo.")

        print("Popolamento della tabella Station e creazione delle relazioni...")
        with open('scripts/stations_final.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                station = Station(
                    name=row.get('name').strip() if row.get('name') else None,
                    url=row.get('url').strip() if row.get('url') else None,
                    url_resolved=row.get('url_resolved').strip() if row.get('url_resolved') else None,
                    homepage=row.get('homepage').strip() if row.get('homepage') else None,
                    favicon=row.get('favicon').strip() if row.get('favicon') else None,
                    country=row.get('country').strip() if row.get('country') else None,
                    countrycode=row.get('countrycode').strip() if row.get('countrycode') else None,
                    state=row.get('state').strip() if row.get('state') else None,
                    codec=row.get('codec').strip() if row.get('codec') else None,
                    bitrate=int(row['bitrate']) if row.get('bitrate') else None,
                    geo_lat=float(row['geo_lat']) if row.get('geo_lat') else None,
                    geo_long=float(row['geo_long']) if row.get('geo_long') else None
                )

                if row.get('Music Genre'):
                    for genre_name in [g.strip() for g in row['Music Genre'].split(',') if g.strip()]:
                        station.music_genres.append(genre_map[genre_name])

                if row.get('Decade'):
                    for decade_name in [d.strip() for d in row['Decade'].split(',') if d.strip()]:
                        station.decades.append(decade_map[decade_name])

                if row.get('Topic'):
                    for topic_name in [t.strip() for t in row['Topic'].split(',') if t.strip()]:
                        station.topics.append(topic_map[topic_name])

                if row.get('Lang'):
                    for lang_name in [l.strip() for l in row['Lang'].split(',') if l.strip()]:
                        station.langs.append(lang_map[lang_name])

                if row.get('Mood'):
                    for mood_name in [m.strip() for m in row['Mood'].split(',') if m.strip()]:
                        station.moods.append(mood_map[mood_name])

                db.session.add(station)

        print("Salvataggio delle stazioni e delle loro relazioni...")
        db.session.commit()
        print("\nPopolamento del database completato!")


if __name__ == '__main__':
    populate_database()