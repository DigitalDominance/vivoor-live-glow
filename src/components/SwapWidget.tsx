import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/theme/ThemeProvider';

const SwapWidget: React.FC = () => {
  const { theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Update iframe src when theme changes
    if (iframeRef.current) {
      const isDark = theme === 'dark';
      const newSrc = `https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=false&amount=0.01&amountFiat=1500&backgroundColor=00000&darkMode=${isDark}&from=btc&fromFiat=eur&horizontal=true&isFiat=false&lang=en-US&link_id=26eb6983a7bef9&locales=true&logo=false&primaryColor=00ffff&to=kas&toFiat=kas&toTheMoon=true`;
      iframeRef.current.src = newSrc;
    }
  }, [theme]);

  const isDark = theme === 'dark';
  const iframeSrc = `https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=false&amount=0.01&amountFiat=1500&backgroundColor=00000&darkMode=${isDark}&from=btc&fromFiat=eur&horizontal=true&isFiat=false&lang=en-US&link_id=26eb6983a7bef9&locales=true&logo=false&primaryColor=00ffff&to=kas&toFiat=kas&toTheMoon=true`;

  return (
    <div className="relative rounded-xl p-[2px] bg-gradient-to-r from-brand-purple via-brand-pink to-brand-cyan shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="rounded-xl overflow-hidden bg-background">
        <iframe
          ref={iframeRef}
          id="iframe-widget"
          src={iframeSrc}
          style={{ height: '205px', width: '100%', border: 'none' }}
          className="rounded-xl"
          title="Crypto Exchange Widget"
        />
      </div>
      <script
        defer
        type="text/javascript"
        src="https://changenow.io/embeds/exchange-widget/v2/stepper-connector.js"
      />
    </div>
  );
};

export default SwapWidget;