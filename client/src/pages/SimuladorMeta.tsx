import { useState, useEffect, useRef } from 'react';
import {
  Play, RotateCcw, Instagram, Send, CheckCircle2, LogIn,
  Shield, MessageSquare, Smartphone, Monitor, ArrowRight,
  ChevronRight, Settings, Pause, SkipForward, Search,
  Inbox, LayoutDashboard, Kanban, Users, Package, DollarSign,
  Bell, Bot, Workflow, Zap, LogOut, Phone, Smile, Paperclip,
  Mic, MoreVertical, Check, CheckCheck, ChevronDown,
  Globe, Eye, Video, Image, X, Menu,
} from 'lucide-react';

// ============ TYPES ============
interface ChatMessage {
  from: 'user' | 'business';
  text: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  showTyping?: boolean;
}

interface Conversa {
  nome: string;
  avatar: string;
  ultimaMsg: string;
  hora: string;
  naoLidas: number;
  canal: 'instagram' | 'whatsapp';
  ativo?: boolean;
}

// ============ DATA ============
const CONVERSAS: Conversa[] = [
  { nome: 'Sarah Costa', avatar: 'SC', ultimaMsg: 'Hi! I saw a beautiful gold ring...', hora: '2:30 PM', naoLidas: 1, canal: 'instagram', ativo: true },
  { nome: 'Julia Mendes', avatar: 'JM', ultimaMsg: 'Obrigada pelo atendimento!', hora: '1:45 PM', naoLidas: 0, canal: 'whatsapp' },
  { nome: 'Carlos Silva', avatar: 'CS', ultimaMsg: 'Quero saber sobre aliancas', hora: '12:20 PM', naoLidas: 0, canal: 'instagram' },
  { nome: 'Maria Oliveira', avatar: 'MO', ultimaMsg: 'Vocês entregam em SP?', hora: '11:30 AM', naoLidas: 0, canal: 'whatsapp' },
  { nome: 'Pedro Santos', avatar: 'PS', ultimaMsg: 'Foto do anel por favor', hora: 'Yesterday', naoLidas: 0, canal: 'instagram' },
  { nome: 'Ana Beatriz', avatar: 'AB', ultimaMsg: 'Quanto custa a corrente?', hora: 'Yesterday', naoLidas: 0, canal: 'whatsapp' },
  { nome: 'Rafael Lima', avatar: 'RL', ultimaMsg: 'Muito obrigado!', hora: 'Yesterday', naoLidas: 0, canal: 'instagram' },
  { nome: 'Fernanda Alves', avatar: 'FA', ultimaMsg: 'Vou pensar e volto', hora: '2 days ago', naoLidas: 0, canal: 'whatsapp' },
];

const INCOMING_MESSAGES: ChatMessage[] = [
  { from: 'user', text: 'Hi! I saw a beautiful gold ring on your Instagram page. Is it still available?', time: '2:30 PM' },
  { from: 'business', text: 'Hello! Yes, it\'s available! It\'s our 18k gold ring with small diamonds. Would you like more details?', time: '2:31 PM', status: 'read' },
  { from: 'user', text: 'Yes please! How much is it and do you ship?', time: '2:32 PM' },
];

const REPLY_TEXT = 'The 18k gold ring with diamonds is R$3,200. Yes, we ship nationwide! Free shipping for orders over R$2,000. Would you like to place an order? 💍';

// ============ ANNOTATION COMPONENT ============
function Annotation({ text, position = 'top', visible }: { text: string; position?: 'top' | 'bottom' | 'left' | 'right'; visible: boolean }) {
  if (!visible) return null;

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-amber-500 border-l-transparent border-r-transparent border-b-transparent border-[6px]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-amber-500 border-l-transparent border-r-transparent border-t-transparent border-[6px]',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-amber-500 border-t-transparent border-b-transparent border-r-transparent border-[6px]',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-amber-500 border-t-transparent border-b-transparent border-l-transparent border-[6px]',
  };

  return (
    <div className={`absolute ${posClasses[position]} z-50 animate-fade-in`}>
      <div className="bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap max-w-xs">
        {text}
        <div className={`absolute ${arrowClasses[position]} w-0 h-0`} />
      </div>
    </div>
  );
}

// ============ CRM SIDEBAR ============
function CRMSidebar({ activePage }: { activePage: string }) {
  const navItems = [
    { path: '/mensagens', icon: Inbox, label: 'Inbox' },
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/pipeline', icon: Kanban, label: 'Pipeline' },
    { path: '/clientes', icon: Users, label: 'Clients' },
    { path: '/produtos', icon: Package, label: 'Products' },
    { path: '/vendas', icon: DollarSign, label: 'Sales' },
    { path: '/lembretes', icon: Bell, label: 'Reminders', badge: '3' },
    { path: '/agentes-ia', icon: Bot, label: 'AI Agents' },
    { path: '/whatsapp', icon: Smartphone, label: 'WhatsApp' },
    { path: '/automacoes', icon: Workflow, label: 'Automations' },
    { path: '/simulador', icon: Zap, label: 'Simulator' },
  ];

  return (
    <div className="w-[68px] bg-[#1a2e28] flex flex-col items-center py-4 flex-shrink-0">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center">
        <div className="w-10 h-10 bg-alisson-600 rounded-full flex items-center justify-center mb-1">
          <img src="/leao.svg" alt="" className="w-5 h-5 opacity-90" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <span className="text-[9px] text-creme-300 font-medium">PRO</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 w-full">
        {navItems.map((item) => {
          const isActive = activePage === item.path;
          const Icon = item.icon;
          return (
            <div
              key={item.path}
              className={`relative flex items-center justify-center py-3 cursor-pointer transition-colors ${
                isActive ? 'text-white bg-white/10' : 'text-[#8696a0] hover:text-white hover:bg-white/5'
              }`}
            >
              {isActive && <div className="absolute left-0 w-[3px] h-6 bg-creme-300 rounded-r-full" />}
              <Icon size={22} />
              {item.badge && (
                <span className="absolute top-1.5 right-2.5 bg-[#25d366] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-1 w-full mt-auto">
        <div className={`flex items-center justify-center py-3 cursor-pointer transition-colors ${
          activePage === '/configuracoes' ? 'text-white bg-white/10' : 'text-[#8696a0] hover:text-white hover:bg-white/5'
        }`}>
          {activePage === '/configuracoes' && <div className="absolute left-0 w-[3px] h-6 bg-creme-300 rounded-r-full" />}
          <Settings size={22} />
        </div>
        <div className="flex items-center justify-center py-3 text-[#8696a0] hover:text-white hover:bg-white/5 cursor-pointer transition-colors">
          <LogOut size={22} />
        </div>
      </div>
    </div>
  );
}

// ============ LOGIN SCREEN ============
function LoginScreen({ phase, annotation }: { phase: 'idle' | 'typing' | 'loading' | 'done'; annotation: string }) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Top green section */}
      <div className="h-56 bg-alisson-600 relative" />
      {/* Bottom cream section */}
      <div className="flex-1 bg-creme-200 relative flex items-start justify-center -mt-32">
        <div className="relative">
          <Annotation text={annotation} position="top" visible={!!annotation} />
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-6">
              <img src="/leao.svg" alt="" className="w-5 h-5 mx-auto mb-4 opacity-80" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <h1 className="text-2xl font-bold text-alisson-600">IAlisson</h1>
              <p className="text-sm text-gray-500">Unified inbox</p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-alisson-400 focus:outline-none"
                  value={phase !== 'idle' ? 'admin@alissonjoias.com' : ''}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-alisson-400 focus:outline-none"
                  value={phase !== 'idle' ? '••••••••' : ''}
                  readOnly
                />
              </div>
              <button className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                phase === 'loading' ? 'bg-alisson-500' : 'bg-alisson-600 hover:bg-alisson-500'
              }`}>
                {phase === 'loading' ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : 'Sign in'}
              </button>
            </div>

            <div className="mt-6 bg-creme-100 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Alisson Joias CRM — Jewelry Management System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ SETTINGS / INSTAGRAM CONNECT ============
function SettingsScreen({ phase, annotation }: { phase: 'initial' | 'connecting' | 'connected'; annotation: string }) {
  return (
    <div className="flex h-full bg-[#f0f2f5]">
      <CRMSidebar activePage="/configuracoes" />
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Settings size={22} className="text-gray-500" />
          Settings
        </h1>

        <div className="max-w-3xl space-y-6">
          {/* Instagram card */}
          <div className="relative">
            <Annotation text={annotation} position="top" visible={!!annotation} />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center">
                    <Instagram className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Instagram — Connected Accounts</h3>
                    <p className="text-xs text-gray-500">Connect your Instagram Business account to receive and send DMs</p>
                  </div>
                </div>
                {phase === 'initial' && (
                  <button className="px-4 py-2 bg-alisson-600 text-white rounded-lg text-sm font-medium hover:bg-alisson-500 flex items-center gap-2 transition-colors">
                    <Instagram size={16} />
                    Connect Instagram
                  </button>
                )}
              </div>

              <div className="p-6">
                {phase === 'initial' && (
                  <div className="text-center py-8 text-gray-400">
                    <Instagram size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No Instagram accounts connected</p>
                    <p className="text-xs mt-1">Click "Connect Instagram" to start the OAuth flow</p>
                  </div>
                )}

                {phase === 'connecting' && (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 border-4 border-alisson-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Connecting to Facebook...</p>
                    <p className="text-xs text-gray-400 mt-1">Exchanging authorization code for access token</p>
                  </div>
                )}

                {phase === 'connected' && (
                  <div className="border-2 border-green-400 bg-green-50 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                        AJ
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-800">Alisson Joias</h3>
                          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">@alissonjoias</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span>Instagram Business</span>
                          <span>•</span>
                          <span>Page: Alisson Joias</span>
                          <span>•</span>
                          <span>487 contacts</span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {[
                        { label: 'Receive DMs', value: 'Active', color: 'green' },
                        { label: 'Receive Comments', value: 'Active', color: 'green' },
                        { label: 'AI Auto-reply', value: 'Active', color: 'green' },
                        { label: 'Token', value: 'Valid (60d)', color: 'green' },
                      ].map((item) => (
                        <div key={item.label} className="bg-white rounded-lg p-2.5 text-center border border-green-200">
                          <p className="text-xs text-gray-500">{item.label}</p>
                          <p className={`text-sm font-semibold text-${item.color}-600`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Other config cards (visual filler) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">WhatsApp — Evolution API</h3>
                <p className="text-xs text-gray-500">Connected • 2 active instances</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">AI Agents — Configuration</h3>
                <p className="text-xs text-gray-500">Dara SDR Agent • Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ FACEBOOK OAUTH POPUP ============
function OAuthPopup({ phase, visible }: { phase: 'login' | 'permissions' | 'redirecting'; visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[480px] overflow-hidden animate-fade-in">
        {/* Browser bar */}
        <div className="bg-gray-100 px-4 py-2 flex items-center gap-3 border-b">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-500 flex items-center gap-2">
            <Shield size={12} className="text-green-500" />
            <span>https://www.facebook.com/v22.0/dialog/oauth</span>
          </div>
          <X size={14} className="text-gray-400" />
        </div>

        {phase === 'login' && (
          <div className="p-8">
            {/* Facebook header */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <svg viewBox="0 0 36 36" className="w-10 h-10" fill="#1877F2">
                <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 26h-3v-4h3v-3c0-3.309 1.791-5 5-5h3v4h-3c-.552 0-1 .449-1 1v3h4l-1 4h-3v9.938c.607.045 1.217.062 1.832.062.614 0 1.221-.02 1.823-.062l.529-.068z" />
              </svg>
              <span className="text-2xl font-bold text-gray-800">Facebook</span>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-700">Log into Facebook to continue to</p>
              <p className="font-semibold text-gray-800">Alisson Joias CRM</p>
            </div>

            <div className="space-y-3 max-w-sm mx-auto">
              <input className="w-full px-4 py-3 border border-gray-300 rounded-md text-sm" value="alisson@alissonjoias.com" readOnly />
              <input className="w-full px-4 py-3 border border-gray-300 rounded-md text-sm" type="password" value="••••••••••" readOnly />
              <button className="w-full py-3 bg-[#1877F2] text-white rounded-md font-semibold text-sm">
                Log In
              </button>
            </div>
          </div>
        )}

        {phase === 'permissions' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <svg viewBox="0 0 36 36" className="w-8 h-8 flex-shrink-0" fill="#1877F2">
                <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 26h-3v-4h3v-3c0-3.309 1.791-5 5-5h3v4h-3c-.552 0-1 .449-1 1v3h4l-1 4h-3v9.938c.607.045 1.217.062 1.832.062.614 0 1.221-.02 1.823-.062l.529-.068z" />
              </svg>
              <div>
                <p className="font-semibold text-gray-800">Alisson Joias CRM</p>
                <p className="text-xs text-gray-500">wants access to your information</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
              <p className="text-sm font-medium text-gray-700">This app will receive access to:</p>
              {[
                { perm: 'instagram_basic', desc: 'Access your Instagram Business profile' },
                { perm: 'instagram_manage_messages', desc: 'Send and receive Instagram Direct Messages' },
                { perm: 'pages_messaging', desc: 'Send and receive messages on your Pages' },
                { perm: 'pages_show_list', desc: 'Show list of Pages you manage' },
                { perm: 'business_management', desc: 'Access your business settings' },
              ].map((p) => (
                <div key={p.perm} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-200">
                  <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{p.perm}</p>
                    <p className="text-xs text-gray-500">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-md font-medium text-sm">Cancel</button>
              <button className="flex-1 py-2.5 bg-[#1877F2] text-white rounded-md font-medium text-sm">Continue as Alisson</button>
            </div>
          </div>
        )}

        {phase === 'redirecting' && (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium text-gray-700">Redirecting to Alisson Joias CRM...</p>
            <p className="text-xs text-gray-400 mt-2">Exchanging authorization code for long-lived access token</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ MESSAGING SCREEN ============
function MessagingScreen({
  messages, conversas, typing, replyText, showReply, replyStatus, annotation, highlightInput
}: {
  messages: ChatMessage[];
  conversas: Conversa[];
  typing: boolean;
  replyText: string;
  showReply: boolean;
  replyStatus: 'sending' | 'sent' | 'delivered' | 'read';
  annotation: string;
  highlightInput: boolean;
}) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, showReply, typing]);

  const allMessages = showReply
    ? [...messages, { from: 'business' as const, text: replyText, time: '2:33 PM', status: replyStatus }]
    : messages;

  return (
    <div className="flex h-full bg-[#d1d7db]">
      <CRMSidebar activePage="/mensagens" />
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list */}
        <div className="w-[360px] flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
          {/* Header */}
          <div className="bg-alisson-600 px-4 py-3 flex items-center gap-3">
            <img src="/leao-branco.svg" alt="" className="w-7 h-7 opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="font-bold text-creme-100 text-lg">IAlisson</span>
          </div>

          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-2 bg-white rounded-lg text-sm border border-gray-200 focus:outline-none"
                placeholder="Search conversations..."
                readOnly
              />
            </div>
          </div>

          {/* Filters */}
          <div className="px-3 py-1.5 border-b border-gray-100 flex gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-alisson-600 text-white font-medium">All</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Unread</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
              <Instagram size={10} /> Instagram
            </span>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {conversas.map((c, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                c.ativo ? 'bg-alisson-50 border-l-3 border-alisson-600' : 'hover:bg-gray-50'
              }`}>
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                  c.canal === 'instagram'
                    ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400'
                    : 'bg-emerald-500'
                }`}>
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${c.ativo ? 'font-bold text-gray-800' : 'font-medium text-gray-700'}`}>{c.nome}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{c.hora}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-gray-500 truncate">{c.ultimaMsg}</span>
                    {c.naoLidas > 0 && (
                      <span className="bg-[#25d366] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {c.naoLidas}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                SC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800 text-sm">Sarah Costa</h3>
                  <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Instagram size={10} />
                    Instagram DM
                  </span>
                </div>
                <p className="text-xs text-gray-500">@sarahcosta_jewelry • Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-1 rounded-full flex items-center gap-1">
                <Bot size={10} />
                Auto Mode
              </span>
              <MoreVertical size={18} className="text-gray-400" />
            </div>
          </div>

          {/* Messages area */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#e5ddd5' }}>
            {allMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'business' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[65%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  msg.from === 'business'
                    ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
                    : 'bg-white text-gray-800 rounded-tl-none'
                }`}>
                  <p className="leading-relaxed">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-400">{msg.time}</span>
                    {msg.from === 'business' && msg.status && (
                      <span className="ml-0.5">
                        {(msg.status === 'sending') && <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />}
                        {(msg.status === 'sent') && <Check size={12} className="text-gray-400" />}
                        {(msg.status === 'delivered') && <CheckCheck size={12} className="text-gray-400" />}
                        {(msg.status === 'read') && <CheckCheck size={12} className="text-[#53bdeb]" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-end">
                <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="relative">
            <Annotation text={annotation} position="top" visible={!!annotation} />
            <div className={`flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] border-t border-gray-200 ${
              highlightInput ? 'ring-2 ring-amber-400 ring-inset' : ''
            }`}>
              <button className="p-2 text-gray-500 hover:text-gray-700"><Smile size={22} /></button>
              <button className="p-2 text-gray-500 hover:text-gray-700"><Paperclip size={22} /></button>
              <input
                className="flex-1 px-4 py-2.5 bg-white rounded-full text-sm border border-gray-200 focus:outline-none"
                placeholder="Type a message..."
                value={typing ? REPLY_TEXT.substring(0, Math.min(REPLY_TEXT.length, 60)) + '...' : (showReply ? '' : '')}
                readOnly
              />
              <button className={`p-2.5 rounded-full transition-colors ${
                typing || showReply ? 'bg-alisson-600 text-white' : 'text-gray-500'
              }`}>
                {typing || showReply ? <Send size={18} /> : <Mic size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right panel - Contact info */}
        <div className="w-[280px] bg-white border-l border-gray-200 p-4 flex-shrink-0 overflow-y-auto">
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
              SC
            </div>
            <h3 className="font-bold text-gray-800">Sarah Costa</h3>
            <p className="text-xs text-gray-500">@sarahcosta_jewelry</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Instagram size={12} className="text-purple-500" />
              <span className="text-xs text-purple-600">Instagram DM</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Phone</p>
              <p className="text-sm text-gray-700">+55 85 99901-2233</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-sm text-gray-700">sarah.costa@email.com</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Source</p>
              <p className="text-sm text-gray-700">Instagram DM</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">instagram</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">interested</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ INSTAGRAM PHONE NATIVE ============
function InstagramNative({ messages, showNew, status }: {
  messages: ChatMessage[];
  showNew: boolean;
  status: 'sent' | 'delivered';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [showNew]);

  return (
    <div style={{ width: '320px' }} className="mx-auto flex-shrink-0">
      <div className="bg-black rounded-[2.8rem] p-3 shadow-2xl">
        <div className="bg-white rounded-[2.2rem] overflow-hidden">
          {/* Status bar */}
          <div className="px-6 pt-3 pb-1 flex items-center justify-between">
            <span className="text-xs font-semibold">2:33 PM</span>
            <div className="w-24 h-6 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="6" width="3" height="6" rx="1" fill="#333"/><rect x="4.5" y="4" width="3" height="8" rx="1" fill="#333"/><rect x="9" y="1.5" width="3" height="10.5" rx="1" fill="#333"/><rect x="13" y="0" width="3" height="12" rx="1" fill="#333"/></svg>
              <div className="w-6 h-3 border border-gray-800 rounded-sm relative ml-1">
                <div className="absolute inset-[2px] bg-gray-800 rounded-[1px]" style={{ width: '65%' }} />
              </div>
            </div>
          </div>

          {/* Instagram header */}
          <div className="border-b px-4 py-2 flex items-center gap-3">
            <ChevronRight size={22} className="text-gray-800 rotate-180" />
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-pink-200">
              AJ
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">Alisson Joias</p>
              <p className="text-[10px] text-gray-500">alissonjoias • Active now</p>
            </div>
            <Phone size={20} className="text-gray-800" />
            <Video size={20} className="text-gray-800" />
          </div>

          {/* Messages */}
          <div ref={ref} className="p-3 space-y-2 min-h-[340px] max-h-[380px] overflow-y-auto bg-white">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.from === 'business' && (
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center text-white text-[8px] font-bold mr-2 mt-auto flex-shrink-0">
                    AJ
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                  msg.from === 'user'
                    ? 'bg-[#3797F0] text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-[13px] leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}

            {showNew && (
              <>
                <div className="flex justify-start">
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-full flex items-center justify-center text-white text-[8px] font-bold mr-2 mt-auto flex-shrink-0">
                    AJ
                  </div>
                  <div className="max-w-[75%] rounded-2xl px-3.5 py-2 bg-gray-100 text-gray-800">
                    <p className="text-[13px] leading-relaxed">{REPLY_TEXT}</p>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-gray-400">
                    {status === 'delivered' ? 'Delivered' : 'Sent'} • 2:33 PM
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#3797F0] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            </div>
            <div className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-xs text-gray-400">
              Message...
            </div>
            <Image size={20} className="text-gray-600" />
            <Mic size={20} className="text-gray-600" />
          </div>

          {/* Home indicator */}
          <div className="flex justify-center py-2">
            <div className="w-28 h-1 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ SPLIT VIEW (CRM + Instagram) ============
function SplitView({
  messages, conversas, showNew, replyStatus, nativeStatus, annotation
}: {
  messages: ChatMessage[];
  conversas: Conversa[];
  showNew: boolean;
  replyStatus: 'sending' | 'sent' | 'delivered' | 'read';
  nativeStatus: 'sent' | 'delivered';
  annotation: string;
}) {
  return (
    <div className="flex h-full">
      {/* CRM side */}
      <div className="flex-1 flex flex-col min-w-0">
        <MessagingScreen
          messages={messages}
          conversas={conversas}
          typing={false}
          replyText={REPLY_TEXT}
          showReply={true}
          replyStatus={replyStatus}
          annotation=""
          highlightInput={false}
        />
      </div>

      {/* Divider with arrow */}
      <div className="w-20 flex flex-col items-center justify-center bg-gray-100 flex-shrink-0 relative">
        <Annotation text={annotation} position="bottom" visible={!!annotation} />
        <div className="flex flex-col items-center gap-2">
          <Monitor size={24} className="text-gray-400" />
          <ArrowRight size={28} className="text-amber-500 animate-pulse" />
          <Smartphone size={24} className="text-gray-400" />
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center font-medium">Same message<br/>delivered</p>
      </div>

      {/* Instagram phone */}
      <div className="w-[360px] flex items-center justify-center bg-gray-50 flex-shrink-0 p-4">
        <div className="relative">
          <div className="text-center mb-3">
            <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full flex items-center gap-1 justify-center w-fit mx-auto">
              <Smartphone size={12} />
              Instagram Native App — User's phone
            </span>
          </div>
          <InstagramNative
            messages={INCOMING_MESSAGES}
            showNew={showNew}
            status={nativeStatus}
          />
        </div>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function SimuladorMeta() {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState<string>('idle'); // idle, login, settings_initial, oauth_login, oauth_perms, oauth_redirect, settings_connected, messaging_receive, messaging_typing, messaging_sent, split_sending, split_delivered, complete
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const sleep = (ms: number) => new Promise<void>((resolve) => {
    const check = () => {
      if (!pausedRef.current) resolve();
      else setTimeout(check, 100);
    };
    setTimeout(check, ms);
  });

  const [loginPhase, setLoginPhase] = useState<'idle' | 'typing' | 'loading' | 'done'>('idle');
  const [settingsPhase, setSettingsPhase] = useState<'initial' | 'connecting' | 'connected'>('initial');
  const [oauthPhase, setOauthPhase] = useState<'login' | 'permissions' | 'redirecting'>('login');
  const [showOAuth, setShowOAuth] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyStatus, setReplyStatus] = useState<'sending' | 'sent' | 'delivered' | 'read'>('sending');
  const [showInNative, setShowInNative] = useState(false);
  const [nativeStatus, setNativeStatus] = useState<'sent' | 'delivered'>('sent');
  const [annotation, setAnnotation] = useState('');

  const reset = () => {
    setRunning(false);
    setPaused(false);
    setStep('idle');
    setLoginPhase('idle');
    setSettingsPhase('initial');
    setOauthPhase('login');
    setShowOAuth(false);
    setChatMessages([]);
    setIsTyping(false);
    setShowReply(false);
    setReplyStatus('sending');
    setShowInNative(false);
    setNativeStatus('sent');
    setAnnotation('');
  };

  const runDemo = async () => {
    reset();
    setRunning(true);

    // === STEP 1: CRM Login ===
    setStep('login');
    setAnnotation('Step 1: User logs into the CRM application');
    await sleep(2000);
    setLoginPhase('typing');
    setAnnotation('Entering credentials to access the dashboard');
    await sleep(2000);
    setLoginPhase('loading');
    setAnnotation('Authenticating user...');
    await sleep(1500);
    setLoginPhase('done');
    await sleep(1000);

    // === STEP 2: Navigate to Settings ===
    setStep('settings_initial');
    setAnnotation('Step 2: Navigate to Settings > Instagram to connect account');
    await sleep(3000);

    // === STEP 3: Click Connect → OAuth popup ===
    setAnnotation('Clicking "Connect Instagram" opens Facebook OAuth dialog');
    await sleep(1500);
    setShowOAuth(true);
    setStep('oauth_login');
    setAnnotation('Step 3: Facebook OAuth login — user authenticates with Facebook');
    await sleep(3500);

    // OAuth permissions
    setOauthPhase('permissions');
    setStep('oauth_perms');
    setAnnotation('Step 4: User grants required permissions (instagram_manage_messages, pages_messaging)');
    await sleep(4000);

    // OAuth redirect
    setOauthPhase('redirecting');
    setStep('oauth_redirect');
    setAnnotation('Authorization code exchanged for long-lived access token (60 days)');
    await sleep(2500);
    setShowOAuth(false);

    // === STEP 4: Account connected ===
    setSettingsPhase('connecting');
    await sleep(1500);
    setSettingsPhase('connected');
    setStep('settings_connected');
    setAnnotation('Step 5: Instagram Business account successfully connected — DMs, comments, and mentions enabled');
    await sleep(4000);

    // === STEP 5: Navigate to Messaging ===
    setStep('messaging_receive');
    setAnnotation('Step 6: Incoming Instagram DM appears in the unified inbox');
    await sleep(2000);

    // Messages arrive one by one
    for (let i = 0; i < INCOMING_MESSAGES.length; i++) {
      await sleep(1500);
      setChatMessages(prev => [...prev, INCOMING_MESSAGES[i]]);
      if (i === 0) setAnnotation('Customer sends a Direct Message via Instagram');
      if (i === 1) setAnnotation('Agent (or AI) replies through the CRM interface');
      if (i === 2) setAnnotation('Conversation continues in real-time');
    }
    await sleep(2000);

    // === STEP 6: Agent types reply ===
    setStep('messaging_typing');
    setAnnotation('Step 7: Agent composes a reply message in the CRM app');
    setIsTyping(true);
    await sleep(3500);
    setIsTyping(false);

    // Send the reply
    setShowReply(true);
    setReplyStatus('sending');
    setStep('messaging_sent');
    setAnnotation('Message sent from the CRM via Instagram Messaging API');
    await sleep(1000);
    setReplyStatus('sent');
    await sleep(1000);
    setReplyStatus('delivered');
    setAnnotation('Message delivered — status updated in real-time');
    await sleep(1000);
    setReplyStatus('read');
    await sleep(2000);

    // === STEP 7: Show in native Instagram ===
    setStep('split_sending');
    setAnnotation('Step 8: The same message appears in the Instagram native app on the user\'s phone');
    await sleep(2000);
    setShowInNative(true);
    setNativeStatus('sent');
    await sleep(1500);
    setNativeStatus('delivered');
    setStep('split_delivered');
    setAnnotation('Message successfully delivered — visible in both CRM and Instagram native client');
    await sleep(5000);

    // === COMPLETE ===
    setStep('complete');
    setAnnotation('');
    setRunning(false);
  };

  // Render the current step
  const renderContent = () => {
    switch (step) {
      case 'idle':
        return (
          <div className="h-full flex flex-col items-center justify-center bg-[#f0f2f5] text-gray-500 gap-4">
            <div className="w-20 h-20 bg-alisson-50 rounded-full flex items-center justify-center">
              <Instagram size={36} className="text-alisson-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-700">Instagram DM Integration Demo</h2>
            <p className="text-sm text-gray-500 max-w-md text-center">
              Complete end-to-end demonstration: OAuth login, permission grant, account connection,
              send & receive DMs, and message delivery verification in Instagram native client.
            </p>
            <button
              onClick={runDemo}
              className="mt-4 px-6 py-3 bg-alisson-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-alisson-500 transition-colors shadow-lg"
            >
              <Play size={18} />
              Start Demo
            </button>
          </div>
        );

      case 'login':
        return <LoginScreen phase={loginPhase} annotation={annotation} />;

      case 'settings_initial':
      case 'settings_connected':
        return <SettingsScreen phase={settingsPhase} annotation={annotation} />;

      case 'oauth_login':
      case 'oauth_perms':
      case 'oauth_redirect':
        return <SettingsScreen phase={settingsPhase} annotation="" />;

      case 'messaging_receive':
      case 'messaging_typing':
      case 'messaging_sent':
        return (
          <MessagingScreen
            messages={chatMessages}
            conversas={CONVERSAS}
            typing={isTyping}
            replyText={REPLY_TEXT}
            showReply={showReply}
            replyStatus={replyStatus}
            annotation={annotation}
            highlightInput={isTyping}
          />
        );

      case 'split_sending':
      case 'split_delivered':
        return (
          <SplitView
            messages={chatMessages}
            conversas={CONVERSAS}
            showNew={showInNative}
            replyStatus={replyStatus}
            nativeStatus={nativeStatus}
            annotation={annotation}
          />
        );

      case 'complete':
        return (
          <div className="h-full flex flex-col items-center justify-center bg-[#f0f2f5] text-gray-500 gap-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-green-700">Demo Complete</h2>
            <p className="text-sm text-gray-500 max-w-lg text-center">
              All Meta App Review requirements demonstrated successfully:
              OAuth login flow, permission grants, asset selection, message send/receive,
              and delivery verification in Instagram native client.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
              {[
                'OAuth Login Flow',
                'Permission Grant',
                'Account Selection',
                'Receive Instagram DM',
                'Send Reply from CRM',
                'Real-time Sync',
                'Delivery Status',
                'Native Client Verification',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-green-200">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-700">{item}</span>
                </div>
              ))}
            </div>
            <button
              onClick={reset}
              className="mt-4 px-5 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-300 transition-colors text-sm"
            >
              <RotateCcw size={16} />
              Reset Demo
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden -m-4 md:-m-6">
      {/* Floating controls - only show when running */}
      {running && (
        <div className="absolute top-4 right-4 z-[90] flex gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className="px-3 py-1.5 bg-black/60 text-white rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={reset}
            className="px-3 py-1.5 bg-black/60 text-white rounded-full text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      )}

      {/* OAuth popup overlay */}
      <OAuthPopup phase={oauthPhase} visible={showOAuth} />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* Bottom annotation bar */}
      {annotation && step !== 'idle' && (
        <div className="bg-gray-900 text-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <p className="text-sm font-medium">{annotation}</p>
        </div>
      )}
    </div>
  );
}
