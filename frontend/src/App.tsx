import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { CreateStatic } from './pages/CreateStatic';
import { StaticView } from './pages/StaticView';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="create" element={<CreateStatic />} />
        <Route path="static/:shareCode" element={<StaticView />} />
      </Route>
    </Routes>
  );
}

export default App;
