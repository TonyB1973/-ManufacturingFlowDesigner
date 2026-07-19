import './styles/reset.css';
import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';
import { App } from './app/App';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Application root element was not found.');
}

new App(root).mount();

