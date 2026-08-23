import { useEffect, useState } from 'react';
import './acs-loader.css';

export default function AcsLoader() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const fadeTimer = window.setTimeout(() => setLeaving(true), 1850);
    const removeTimer = window.setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = previousOverflow;
    }, 2550);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`acs-loader${leaving ? ' acs-loader--leaving' : ''}`} role="status" aria-live="polite" aria-label="Carregando ACS">
      <div className="acs-loader__grid" aria-hidden="true" />
      <div className="acs-loader__aurora acs-loader__aurora--one" aria-hidden="true" />
      <div className="acs-loader__aurora acs-loader__aurora--two" aria-hidden="true" />
      <div className="acs-loader__scan" aria-hidden="true" />
      <div className="acs-loader__particles" aria-hidden="true">{Array.from({ length: 12 }).map((_, index) => <span key={index} />)}</div>
      <div className="acs-loader__corner acs-loader__corner--tl" aria-hidden="true" />
      <div className="acs-loader__corner acs-loader__corner--tr" aria-hidden="true" />
      <div className="acs-loader__corner acs-loader__corner--bl" aria-hidden="true" />
      <div className="acs-loader__corner acs-loader__corner--br" aria-hidden="true" />
      <main className="acs-loader__content">
        <div className="acs-loader__logo-stage" aria-hidden="true">
          <div className="acs-loader__orbit acs-loader__orbit--outer" />
          <div className="acs-loader__orbit acs-loader__orbit--middle" />
          <div className="acs-loader__orbit acs-loader__orbit--inner" />
          <div className="acs-loader__logo-halo" />
          <img className="acs-loader__logo" src="/logo-acastilho.svg" alt="" />
          <span className="acs-loader__satellite acs-loader__satellite--one" />
          <span className="acs-loader__satellite acs-loader__satellite--two" />
          <span className="acs-loader__satellite acs-loader__satellite--three" />
        </div>
        <div className="acs-loader__brand-block"><div className="acs-loader__brand">ACS</div><div className="acs-loader__tagline">Software · Produto · IA</div></div>
        <div className="acs-loader__progress-wrap" aria-hidden="true"><div className="acs-loader__progress-track"><span className="acs-loader__progress-fill" /><span className="acs-loader__progress-spark" /></div></div>
        <div className="acs-loader__status" aria-hidden="true"><span>Inicializando experiência</span><span>Conectando serviços</span><span>Preparando ACS</span></div>
      </main>
      <div className="acs-loader__footer" aria-hidden="true"><span className="acs-loader__footer-dot" /><span>Construindo tecnologia para problemas reais</span></div>
    </div>
  );
}
