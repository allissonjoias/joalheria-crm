import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';

export function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!('Notification' in window)) return;

    setPermission(Notification.permission);

    if (Notification.permission === 'default') {
      // Show prompt after 10 seconds
      const dismissed = localStorage.getItem('push-notification-dismissed');
      if (dismissed) {
        const hoursSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60);
        if (hoursSince < 72) return; // Wait 3 days before asking again
      }
      const timer = setTimeout(() => setShowPrompt(true), 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPrompt(false);

      if (result === 'granted') {
        // Show test notification
        new Notification('IAlisson CRM', {
          body: 'Notificacoes ativadas! Voce recebera alertas de novos leads.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          tag: 'welcome',
        });
      }
    } catch (e) {
      console.error('Push notification error:', e);
    }
  };

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push-notification-dismissed', String(Date.now()));
  };

  if (!showPrompt || permission !== 'default') return null;

  return (
    <div className="fixed top-4 right-4 z-[200] animate-slide-down max-w-sm">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 text-sm">Ativar notificacoes?</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Receba alertas quando chegar um novo lead ou mensagem
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={requestPermission}
                className="px-3 py-1.5 bg-alisson-600 text-white rounded-lg text-xs font-medium hover:bg-alisson-500 transition-colors"
              >
                Ativar
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                Agora nao
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility function to send notifications from anywhere in the app
export function sendNotification(title: string, body: string, options?: { tag?: string; data?: any; onClick?: string }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: options?.tag || 'general',
    data: options?.data,
  });

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      window.location.href = options.onClick!;
    };
  }
}
