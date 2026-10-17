import { BrowserRouter } from 'react-router-dom';
import { Widget } from './widget/Widget';
import { BUILD_ID } from '../../src/build-id';
import ReactDOM from 'react-dom/client';

document.documentElement.dataset.build = BUILD_ID;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Widget preview={false} />
  </BrowserRouter>
);
