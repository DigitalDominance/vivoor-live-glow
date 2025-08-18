import React from 'react';
import { createPortal } from 'react-dom';

const useFullscreenElement = () => {
  const [el, setEl] = React.useState<Element | null>(null);
  React.useEffect(() => {
    const update = () => setEl(document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    update();
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return el;
};

const FullscreenPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fsEl = useFullscreenElement();
  const mount = fsEl ?? document.body;
  return createPortal(children, mount);
};

export default FullscreenPortal;