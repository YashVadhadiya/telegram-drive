import { store } from './store.js';
import { router } from './router.js';
import { auth } from './services/auth.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { LoginPage } from './pages/Login.js';
import { DashboardPage } from './pages/Dashboard.js';
import { FoldersPage } from './pages/Folders.js';
import { FilesPage } from './pages/Files.js';
import { MediaPage } from './pages/Media.js';
import { SettingsPage } from './pages/Settings.js';
import { TrashPage } from './pages/Trash.js';
import { FavoritesPage } from './pages/Favorites.js';

class App {
  constructor() {
    this.initialized = false;
  }

  async init() {
    const appEl = document.getElementById('app');

    this._createLayout(appEl);

    this._initRouter();

    router.start(document.getElementById('page-content'));

    await auth._restoreSession();

    this._hideLoader();

    this.initialized = true;
  }

  _createLayout(appEl) {
    appEl.innerHTML = `
      <div id="sidebar-container"></div>
      <div id="header-container"></div>
      <main class="app-content" id="page-content"></main>
      <div id="toast-container"></div>
      <div id="modal-container"></div>
    `;

    this.sidebar = new Sidebar(document.getElementById('sidebar-container'));
    this.header = new Header(document.getElementById('header-container'));
  }

  _initRouter() {
    router.addRoute('', LoginPage, { title: 'Login' });
    router.addRoute('login', LoginPage, { title: 'Login' });
    router.addRoute('dashboard', DashboardPage, { title: 'Dashboard', auth: true });
    router.addRoute('folders', FoldersPage, { title: 'Folders', auth: true });
    router.addRoute('folders/:id/files', FilesPage, { title: 'Files', auth: true });
    router.addRoute('media/:id', MediaPage, { title: 'Media', auth: true });
    router.addRoute('settings', SettingsPage, { title: 'Settings', auth: true });
    router.addRoute('trash', TrashPage, { title: 'Trash', auth: true });
    router.addRoute('favorites', FavoritesPage, { title: 'Favorites', auth: true });

    router.onUnauthorized(() => router.navigate('login'));
    router.onNotFound(() => router.navigate('dashboard'));
  }

  _hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500);
    }
  }
}

const app = new App();

document.addEventListener('DOMContentLoaded', () => app.init());

export default app;
