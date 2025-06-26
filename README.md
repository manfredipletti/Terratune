# Terratune

Terratune is a global radio discovery platform that lets you explore radio stations on an interactive 3D map, filter by genre, language, and mood, add stations to your favorites, create playlists, and discover popular stations and public playlists.

---

##  Demo

A live demo is available at:  
[https://terratune-backend.onrender.com/](https://terratune-backend.onrender.com/)

---

## Environments

### Production

- **Backend and Frontend are both served by Flask.**
- The frontend is pre-built (with Vite) and served as static files by Flask.
- All API and static content are available from the same server.

### Debug/Development

- **APIs are served by Flask, but the frontend is served by Vite's dev server.**
- Hot-reload and modern JS development experience.
- Useful for rapid frontend development and debugging.

---

## Production Setup

1. **Set Environment Variables**

   You need to set the following environment variables:
   - `DATABASE_URL` (e.g. PostgreSQL connection string)
   - `SECRET_KEY` (Flask secret key)
   - `CESIUM_TOKEN` (Cesium Ion access token)
   - `FLASK_APP=run.py`
   - `FLASK_ENV=production`

   Example (Linux/macOS):
   ```sh
   export DATABASE_URL=your_db_url
   export SECRET_KEY=your_secret_key
   export CESIUM_TOKEN=your_cesium_token
   export FLASK_APP=run.py
   export FLASK_ENV=production
   ```

2. **Install Python and Node.js dependencies**
   ```sh
   pip install -r requirements.txt
   cd frontend
   npm install
   ```

3. **Build the Frontend**
   ```sh
   cd frontend
   npm run build
   cd ..
   ```

4. **Initialize the Database**
   ```sh
   flask db upgrade
   ```

5. **Populate the Database (optional, for demo data)**
   ```sh
   python scripts/poopulate_db.py
   ```

6. **Run the Application**
   ```sh
   python run.py
   ```
   The app will be available at `http://localhost:5001/` (or your configured port).

---

## Debug/Development Setup

1. **Set up the Database**
   - Create a `.env` file in the root with your local database URL:
     ```
     DATABASE_URL=sqlite:///your_local_db.sqlite3
     ```
   - Other environment variables are not required in debug mode.

2. **Set Cesium Token**
   - In development, you can hardcode your Cesium token directly in `frontend/js/views/MapView.js`:
     ```js
     Cesium.Ion.defaultAccessToken = 'your_cesium_token';
     ```

3. **Install dependencies**
   ```sh
   pip install -r requirements.txt
   cd frontend
   npm install
   ```

4. **Run the Backend**
   ```sh
   python run.py
   ```

5. **Run the Frontend (Vite)**
   ```sh
   cd frontend
   npm start
   ```
   - The frontend will be available at `http://localhost:5173/` (default Vite port).
   - The backend API will be available at `http://localhost:5001/api/`.

---

## Features

- **Explore radio stations on a 3D Cesium map**
- **Filter stations** by genre, language, and mood
- **Add stations to favorites**
- **Create and manage playlists**
- **Discover popular stations and public playlists**
- **User authentication** (register/login/logout)
- **Responsive UI** for desktop and mobile

---

## Technologies Used

- **Flask** (Python) — REST API and backend
- **SQLAlchemy** — ORM and migrations
- **CesiumJS** — 3D globe visualization
- **Vite** — Frontend build tool
- **JS, HTML, CSS** — Frontend
- **PostgreSQL** (recommended) or SQLite
