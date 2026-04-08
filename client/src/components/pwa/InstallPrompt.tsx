import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    if (iosDevice) {
      // Show iOS guide after 5 seconds
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop - listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  if (!showBanner || dismissed) return null;

  return (
    <>
      {/* Install banner */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[200] animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-alisson-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Smartphone size={18} />
              <span className="font-semibold text-sm">Instalar IAlisson</span>
            </div>
            <button onClick={handleDismiss} className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <img src="/icons/icon-96x96.png" alt="IAlisson" className="w-14 h-14 rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h3 className="font-bold text-gray-800">IAlisson CRM</h3>
                <p className="text-xs text-gray-500">Acesse o CRM direto do celular</p>
              </div>
            </div>

            <ul className="text-xs text-gray-600 space-y-1.5 mb-4">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-alisson-500 rounded-full" />
                Notificacoes de novos leads em tempo real
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-alisson-500 rounded-full" />
                Responda WhatsApp e Instagram pelo app
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 bg-alisson-500 rounded-full" />
                Acesso rapido ao pipeline e clientes
              </li>
            </ul>

            {isIOS ? (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="w-full py-2.5 bg-alisson-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-alisson-500 transition-colors"
              >
                <Share size={16} />
                Como instalar no iPhone
              </button>
            ) : (
              <button
                onClick={handleInstall}
                className="w-full py-2.5 bg-alisson-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-alisson-500 transition-colors"
              >
                <Download size={16} />
                Instalar agora
              </button>
            )}
          </div>
        </div>
      </div>

      {/* iOS install guide modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[250]" onClick={() => setShowIOSGuide(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="font-bold text-lg text-gray-800 mb-4 text-center">Instalar no iPhone/iPad</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-alisson-100 rounded-full flex items-center justify-center text-alisson-600 font-bold text-sm flex-shrink-0">1</div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">Toque no botao de compartilhar</p>
                  <p className="text-xs text-gray-500">O icone <Share size={12} className="inline" /> na barra inferior do Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-alisson-100 rounded-full flex items-center justify-center text-alisson-600 font-bold text-sm flex-shrink-0">2</div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">Role e toque em "Adicionar a Tela de Inicio"</p>
                  <p className="text-xs text-gray-500">Pode estar mais abaixo na lista de opcoes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-alisson-100 rounded-full flex items-center justify-center text-alisson-600 font-bold text-sm flex-shrink-0">3</div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">Toque em "Adicionar"</p>
                  <p className="text-xs text-gray-500">O app IAlisson vai aparecer na sua tela inicial</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm mt-6"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
