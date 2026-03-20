import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

const DESKTOP_BREAKPOINT = 900;

export function useBreakpoint() {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  const isDesktop = Platform.OS === 'web' && windowWidth >= DESKTOP_BREAKPOINT;

  return { isDesktop, windowWidth };
}
