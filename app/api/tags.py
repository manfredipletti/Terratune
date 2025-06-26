from app.models import MusicGenre, Decade, Topic, Lang, Mood
from app.api import bp
from flask import jsonify

CATEGORY_MODEL_MAP = {
    "Music Genre": MusicGenre,
    "Decade": Decade,
    "Topic": Topic,
    "Lang": Lang,
    "Mood": Mood
}


@bp.route('/tags/categories', methods=['GET'])
def get_categories():
    categories = list(CATEGORY_MODEL_MAP.keys())
    return jsonify(categories)


@bp.route('/tags/<string:category_name>', methods=['GET'])
def get_tags_by_category(category_name):
    model_class = CATEGORY_MODEL_MAP.get(category_name)

    if not model_class:
        return jsonify({"error": "Category not found"}), 404

    tags = model_class.query.order_by(model_class.name).all()
    tag_names = [tag.name for tag in tags]

    return jsonify(tag_names)