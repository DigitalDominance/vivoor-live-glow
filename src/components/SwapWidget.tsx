import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/theme/ThemeProvider';

/*
 * A wrapper around the ChangeNow swap widget. This version introduces a few
 * improvements:
 *
 * 1. On mobile devices the embedded widget is given a larger height to better
 *    accommodate the UI. The iframe height is 300 px on mobile, and reverts to
 *    205 px on medium screens and above (≥768 px).
 *
 * 2. The gradient border now matches the rest of the site – it uses the shared
 *    gradient defined by `bg-grad-primary`, and the inner container has
 *    translucency with backdrop blur just like other cards.
 */
const SwapWidget: React.FC = () => {
  const { theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update iframe src whenever the theme changes
  useEffect(() => {
    if (iframeRef.current) {
      const isDark = theme === 'dark';
      const newSrc =
        `https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=false` +
        `&amount=0.01&amountFiat=1500&backgroundColor=00000` +
        `&darkMode=${isDark}&from=btc&fromFiat=eur&horizontal=true` +
        `&isFiat=false&lang=en-US&link_id=26eb6983a7bef9&locales=true` +
        `&logo=false&primaryColor=b692f6&to=kas&toFiat=eth&toTheMoon=false`;
      iframeRef.current.src = newSrc;
    }
  }, [theme]);

  const isDark = theme === 'dark';
  const iframeSrc =
    `https://changenow.io/embeds/exchange-widget/v2/widget.html?FAQ=false` +
    `&amount=0.01&amountFiat=1500&backgroundColor=00000` +
    `&darkMode=${isDark}&from=btc&fromFiat=eur&horizontal=true` +
    `&isFiat=false&lang=en-US&link_id=26eb6983a7bef9&locales=true` +
    `&logo=false&primaryColor=b692f6&to=kas&toFiat=eth&toTheMoon=false`;

  return (
    <div className="relative rounded-xl p-[1px] bg-grad-primary shadow-[0_10px_40px_-12px_hsl(var(--brand-iris)/0.5)] transition-all duration-300">
      <div className="relative rounded-xl bg-background/70 backdrop-blur-md border border-border overflow-hidden">
        <iframe
          ref={iframeRef}
          id="iframe-widget"
          src={iframeSrc}
          // Responsive height: taller on mobile (<768px) for better usability
          className="rounded-xl w-full border-none h-[355px] md:h-[205px]"
          style={{ border: 'none' }}
          title="Crypto Exchange Widget"
        />
      </div>
      {/* Include ChangeNow's stepper-connector script for proper widget functionality */}
      <script
        defer
        type="text/javascript"
        src="https://changenow.io/embeds/exchange-widget/v2/stepper-connector.js"
      />
    </div>
  );
};

export default SwapWidget;
