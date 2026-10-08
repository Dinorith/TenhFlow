import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetCustomerQueryKey, getGetOrderQueryKey, getGetSettingsQueryKey, getGetTenhflowActivityQueryKey,
  getGetTenhflowDashboardQueryKey, getHealthCheckQueryKey, getListCapturesQueryKey, getListConversationsQueryKey,
  getListCustomersQueryKey, getListDeliveriesQueryKey, getListOrdersQueryKey, getListPaymentsQueryKey,
  getListProductsQueryKey, useConfirmCapture, useCreateCustomer, useCreateProduct, useGetCustomer,
  useGetOrder, useGetSettings, useGetTenhflowActivity, useGetTenhflowDashboard, useHealthCheck,
  useListCaptures, useListConversations, useListCustomers, useListDeliveries, useListOrders,
  useListPayments, useListProducts, useCreateCapture, useUpdateCapture, useUpdateConversation, useUpdateCustomer,
  useUpdateDelivery, useUpdateOrder, useUpdatePayment, useUpdateProduct, useUpdateSettings,
  type Capture, type Customer, type Product,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Banknote, Bell, Boxes, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, CreditCard, ExternalLink, Eye,
  Filter, Headphones, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquareText, Moon, MoreHorizontal,
  Package, Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, Sun, Truck, UserRound,
  Users, X, Zap,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

const routes = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/capture', label: 'Customer capture', icon: Zap, badge: 'queue' },
  { href: '/inbox', label: 'Inbox', icon: MessageSquareText },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products & stock', icon: Boxes },
  { href: '/delivery', label: 'Delivery', icon: Truck },
  { href: '/payments', label: 'Payments', icon: CreditCard },
];

const currency = (n: number, code = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(n);
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'TF';
const pretty = (s = '') => s.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const dateShort = (s?: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

function CacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (prev.current !== undefined && prev.current !== id) qc.clear();
    prev.current = id;
  }), [addListener, qc]);
  return null;
}

const clerkAppearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#187c67', colorForeground: '#26323b', colorMutedForeground: '#76817e',
    colorDanger: '#bc514b', colorBackground: '#fffefa', colorInput: '#fffefa',
    colorInputForeground: '#26323b', colorNeutral: '#e7e4d9', fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#26323b] font-semibold', headerSubtitle: 'text-[#737e7b]',
    socialButtonsBlockButtonText: 'text-[#26323b]', formFieldLabel: 'text-[#34423f]',
    footerActionLink: 'text-[#187c67] font-semibold', footerActionText: 'text-[#737e7b]',
    dividerText: 'text-[#737e7b]', identityPreviewEditButton: 'text-[#187c67]',
    formFieldSuccessText: 'text-[#187c67]', alertText: 'text-[#26323b]',
    logoBox: 'mb-2', logoImage: 'h-9', socialButtonsBlockButton: 'border-[#e7e4d9] rounded-xl',
    formButtonPrimary: 'rounded-xl bg-[#187c67] hover:bg-[#126b58] shadow-none',
    formFieldInput: 'rounded-xl border-[#e7e4d9] bg-[#fffefa]', footerAction: 'text-[#737e7b]',
    dividerLine: 'bg-[#e7e4d9]', alert: 'rounded-xl', otpCodeFieldInput: 'rounded-lg',
    formFieldRow: 'gap-1', main: 'gap-4',
  },
};

function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand-lockup" data-testid="brand-tenhflow"><span className="brand-mark"><span/><span/><span/></span>{!compact && <span>tenhflow</span>}</span>;
}

function setThemePreference(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('tenhflow-theme', theme);
  window.dispatchEvent(new CustomEvent('tenhflow-theme-change', { detail: theme }));
}

function ThemeToggle() {
  const settings = useGetSettings();
  const [dark, setDark] = useState(() => localStorage.getItem('tenhflow-theme') === 'dark');
  useEffect(() => {
    if (settings.data?.appearance === 'light' || settings.data?.appearance === 'dark') setThemePreference(settings.data.appearance);
  }, [settings.data?.appearance]);
  useEffect(() => {
    const sync = (event: Event) => setDark((event as CustomEvent<'light' | 'dark'>).detail === 'dark');
    window.addEventListener('tenhflow-theme-change', sync);
    return () => window.removeEventListener('tenhflow-theme-change', sync);
  }, []);
  useEffect(() => {
    setThemePreference(dark ? 'dark' : 'light');
  }, [dark]);
  return <button className="icon-button" onClick={() => setDark(v => !v)} aria-label="Toggle appearance" data-testid="button-theme-toggle">{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>;
}

function Home() {
  const { isSignedIn } = useUser();
  if (isSignedIn) return <Redirect to="/dashboard"/>;
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="brand-link"><Brand/></Link><div className="landing-actions"><a href="#how-it-works">How it works</a><Link href="/sign-in" className="nav-signin">Sign in</Link><Link href="/sign-up" className="button button-primary">Start selling <ArrowRight size={16}/></Link></div></header>
    <section className="hero-block">
      <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> MADE FOR SOCIAL SELLERS IN CAMBODIA</div><h1>Messages in.<br/><em>Orders handled.</em></h1><p className="hero-lede">You already have the sale in your chat. TenhFlow pulls the details together so you can review, confirm, and get back to your customers.</p><div className="hero-ctas"><Link href="/sign-up" className="button button-primary button-large">Set up your shop <ArrowRight size={17}/></Link><a href="#how-it-works" className="text-link">See how it works <ChevronRight size={16}/></a></div><div className="hero-proof"><div className="proof-avatars"><span>SP</span><span>LK</span><span>MN</span></div><p>Built around the way local shops sell<br/><b>Facebook · Telegram · livestreams</b></p></div></div>
      <div className="hero-art" aria-label="Preview of a reviewed social message becoming an order">
        <div className="art-backdrop"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="art-stamp">CHAT → ORDER</div></div>
        <div className="message-card"><div className="message-head"><div className="avatar avatar-coral">S</div><div><b>Sokha P.</b><small>Messenger · just now</small></div><span className="tiny-status">NEW</span></div><div className="bubble">Can I get the linen set in sage, size M? Please deliver to BKK 1.</div><div className="message-foot"><span><Zap size={13}/> Details found</span><span>92% match</span></div></div>
        <div className="order-card"><div className="order-head"><span>ORDER PREVIEW</span><CheckCircle2 size={16}/></div><div className="product-line"><div className="product-swatch"/> <div><b>Linen co-ord set</b><small>sage · size M · qty 1</small></div><strong>$28</strong></div><div className="order-meta"><span><UserRound size={13}/> Sokha P.</span><span><Truck size={13}/> Phnom Penh</span></div><div className="preview-confirm"><Check size={15}/> Review then confirm</div></div>
        <div className="art-note"><ShieldCheck size={16}/><span><b>You stay in control.</b><br/>Nothing gets confirmed for you.</span></div>
      </div>
    </section>
    <section className="trust-strip"><span>ONE ORDER FLOW</span><b>Facebook</b><i/> <b>Messenger</b><i/> <b>Telegram</b><i/> <b>Live selling</b><small>Social channels are shown as setup states — no messages are sent by TenhFlow.</small></section>
    <section className="story-section" id="how-it-works"><div className="section-kicker">YOUR CHAT IS ALREADY THE ORDER</div><h2>Keep the conversation.<br/><em>Lose the retyping.</em></h2><div className="story-grid"><article className="story-card"><span className="story-number">01</span><div className="story-icon"><MessageSquareText/></div><h3>A buyer says yes</h3><p>A product, a color, a size, maybe an address. It arrives in the same places your customers already message you.</p></article><article className="story-card featured"><span className="story-number">02</span><div className="story-icon"><Zap/></div><h3>TenhFlow gathers the details</h3><p>Customer, item, variant, and quantity are already waiting in a review card. You only fill what is genuinely missing.</p></article><article className="story-card"><span className="story-number">03</span><div className="story-icon"><CheckCircle2/></div><h3>You review and confirm</h3><p>One deliberate confirmation makes an order. From there, keep tabs on payment and delivery in one tidy place.</p></article></div></section>
    <section className="review-callout"><div><span className="section-kicker">SELLER-FIRST BY DESIGN</span><h2>Less admin.<br/><em>More actual selling.</em></h2><p>TenhFlow is not another sprawling business system. It is a calm little hand between the chat and the order book.</p><Link href="/sign-up" className="button button-primary">Try the order flow <ArrowRight size={16}/></Link></div><div className="callout-list"><div><span className="check-circle"><Check size={15}/></span><div><b>Review, don’t re-enter</b><small>Known details stay in the order draft.</small></div></div><div><span className="check-circle"><Check size={15}/></span><div><b>Spot what still needs a reply</b><small>Missing details are called out clearly.</small></div></div><div><span className="check-circle"><Check size={15}/></span><div><b>Nothing sends itself</b><small>Channel connection states are honest and visible.</small></div></div></div></section>
    <footer className="landing-footer"><Brand/><span>Made for the way Cambodia sells online.</span><Link href="/sign-up">Get started <ArrowRight size={14}/></Link></footer>
  </main>;
}

function SignInPage() { return <div className="auth-page"><div className="auth-aside"><Link href="/" className="brand-link"><Brand/></Link><div><span className="eyebrow">THE CHAT-TO-ORDER WORKSPACE</span><h1>Your next order<br/><em>is already here.</em></h1><p>Pick up right where your customers left off.</p></div><div className="auth-aside-foot">A clearer way to sell through social.</div></div><div className="auth-panel"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div>; }
function SignUpPage() { return <div className="auth-page"><div className="auth-aside"><Link href="/" className="brand-link"><Brand/></Link><div><span className="eyebrow">A GOOD DAY TO SELL</span><h1>One less thing<br/><em>to do by hand.</em></h1><p>Set up your shop and get your first product into TenhFlow.</p></div><div className="auth-aside-foot">Your shop. Your calls. Your orders.</div></div><div className="auth-panel"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div>; }

function Guard({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="auth-loading"><Brand/><div className="skeleton-line"/></div>;
  return isSignedIn ? <>{children}</> : <Redirect to="/"/>;
}

function Shell({ children, title, subtitle, action }: { children: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  const [path] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const settings = useGetSettings();
  const { user } = useUser();
  const { signOut } = useClerk();
  const shopName = settings.data?.shopName || 'Your shop';
  const shopLocation = settings.data?.address?.split(',').at(-1)?.trim() || 'Cambodia';
  const currencyCode = settings.data?.currency || 'USD';
  const [activeCurrency, setActiveCurrency] = useState('USD');
  useEffect(() => {
    if (settings.data?.currency && settings.data.currency !== activeCurrency) {
      document.documentElement.dataset.currency = settings.data.currency;
      setActiveCurrency(settings.data.currency);
    }
  }, [settings.data?.currency, activeCurrency]);
  const active = path === '/' ? '/dashboard' : path;
  return <div className="app-shell" data-currency={activeCurrency}>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Link href="/dashboard" className="brand-link"><Brand/></Link><span className="workspace-tag">SHOP WORKSPACE</span></div>
      <div className="shop-switch"><div className="shop-avatar">{initials(shopName)}</div><div><b>{shopName}</b><small>{shopLocation} · {currencyCode}</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div><nav className="side-nav">{routes.map(({ href, label, icon: Icon, badge }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} className={`nav-item ${active === href || (href === '/orders' && active.startsWith('/orders/')) || (href === '/customers' && active.startsWith('/customers/')) ? 'nav-active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={18}/><span>{label}</span>{badge && <span className="nav-count" data-testid="count-capture-queue"><CaptureCount/></span>}</Link>)}</nav>
      <div className="nav-caption nav-caption-lower">SHOP</div><nav className="side-nav"><Link href="/settings" className={`nav-item ${active === '/settings' ? 'nav-active' : ''}`} data-testid="link-nav-settings"><Settings size={18}/><span>Settings</span></Link></nav>
      <div className="sidebar-bottom"><div className="support-box"><div className="support-icon"><Headphones size={17}/></div><b>Need a hand?</b><small>We’re here to help you get moving.</small><button type="button" onClick={() => window.open('mailto:hello@tenhflow.app')} data-testid="button-contact-support">Talk to support <ArrowRight size={13}/></button></div><div className="profile-row"><div className="avatar avatar-teal">{initials(user?.fullName || user?.firstName || 'Seller')}</div><div className="profile-copy"><b>{user?.fullName || user?.firstName || 'Shop owner'}</b><small>{user?.primaryEmailAddress?.emailAddress || 'Your account'}</small></div><button className="profile-menu" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Log out" data-testid="button-logout"><LogOut size={16}/></button></div></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNav(v => !v)} aria-label="Open navigation" data-testid="button-mobile-menu"><Menu size={19}/></button><div className="crumb"><span>TenhFlow</span><ChevronRight size={13}/><b>{title}</b></div></div><div className="topbar-right"><span className="connection-pill"><span className="status-dot"/>Workspace ready</span><ThemeToggle/><NotificationBell/><div className="top-avatar">{initials(user?.fullName || user?.firstName || 'S')}</div></div></header>
      <main className="page-wrap"><div className="page-heading"><div><div className="page-overline">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 data-testid="heading-page-title">{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>{children}</main>
    </div>
  </div>;
}

function NotificationBell() {
  const query = useListCaptures();
  const [open, setOpen] = useState(false);
  const pending = (query.data || []).filter(c => c.status.toLowerCase() !== 'ordered');
  return <div className="notification-wrap">
    <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(value => !value)} data-testid="button-notifications">
      <Bell size={17}/>{pending.length > 0 && <i/>}
    </button>
    {open && <div className="notification-popover" role="dialog" aria-label="Capture notifications" data-testid="panel-notifications">
      <div className="notification-heading"><b>To review</b><span>{pending.length}</span></div>
      {pending.length ? pending.slice(0, 4).map(c => <Link href="/capture" className="notification-item" key={c.id} onClick={() => setOpen(false)} data-testid={`link-notification-${c.id}`}>
        <span className="notification-dot"/><span><b>{c.customerName}</b><small>{c.productName || c.snippet}</small></span><ChevronRight size={14}/>
      </Link>) : <div className="notification-empty"><CheckCircle2 size={17}/><span>All caught up. No captures need review.</span></div>}
      <Link href="/capture" className="notification-footer" onClick={() => setOpen(false)}>Open capture queue <ArrowRight size={14}/></Link>
    </div>}
  </div>;
}

function DataState({ loading, error, retry, children, empty, testId = 'data-state' }: { loading: boolean; error: boolean; retry: () => void; children: ReactNode; empty?: boolean; testId?: string }) {
  if (loading) return <div className="loading-surface" data-testid={`${testId}-loading`}><div className="skeleton-head"/><div className="skeleton-line"/><div className="skeleton-line short"/><div className="skeleton-table"><i/><i/><i/></div></div>;
  if (error) return <div className="empty-surface error-surface" data-testid={`${testId}-error`}><div className="empty-icon"><CircleHelp size={22}/></div><b>We couldn’t load this just now</b><span>Check your connection, then try again.</span><button className="button button-secondary" onClick={retry} data-testid={`button-retry-${testId}`}>Try again</button></div>;
  if (empty) return <div className="empty-surface" data-testid={`${testId}-empty`}><div className="empty-icon"><Package size={22}/></div><b>Nothing here yet</b><span>When there’s something to work on, it’ll show up here.</span></div>;
  return <>{children}</>;
}
function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase();
  const state = /deliver|paid|complete|confirmed|active|ready/.test(key) ? 'good' : /cancel|fail|overdue|issue/.test(key) ? 'bad' : /pending|review|processing|unpaid|new|assigned/.test(key) ? 'warn' : 'neutral';
  return <span className={`status-pill status-${state}`} data-testid={`status-${key.replaceAll(' ', '-')}`}>{pretty(value || '—')}</span>;
}
function PageFrame({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <Shell title={title} subtitle={subtitle} action={action}>{children}</Shell>;
}

function DashboardPage() {
  const d = useGetTenhflowDashboard(); const activity = useGetTenhflowActivity();
  const settings = useGetSettings();
  const [salesRange, setSalesRange] = useState(7);
  if (settings.data && !settings.data.onboarded) return <Redirect to="/onboarding"/>;
  const data = d.data; const shop = settings.data?.shopName || 'your shop';
  const sales = (data?.sales || []).slice(-salesRange);
  const maxSales = Math.max(1, ...sales.map(s => s.revenue));
  const maxPipeline = Math.max(1, ...(data?.pipeline || []).map(p => p.count));
  return <PageFrame title="Good morning" subtitle={`Here’s the shape of ${shop} today.`} action={<Link className="button button-primary" href="/capture"><Zap size={16}/> Review captures <ChevronRight size={15}/></Link>}>
    <DataState loading={d.isLoading} error={d.isError} retry={() => d.refetch()} testId="dashboard">
      <div className="metric-grid">
        <Metric label="Orders today" value={data?.todayOrders ?? 0} note="Confirmed today" icon={<ShoppingCart size={18}/>} tone="teal"/>
        <Metric label="Sales today" value={currency(data?.revenue ?? 0, settings.data?.currency)} note="Order value" icon={<Banknote size={18}/>} tone="amber"/>
        <Metric label="To prepare" value={data?.pendingOrders ?? 0} note="Orders in progress" icon={<Clock3 size={18}/>} tone="blue"/>
        <Metric label="COD to collect" value={currency(data?.codPending ?? 0, settings.data?.currency)} note="Cash on delivery" icon={<CreditCard size={18}/>} tone="rose"/>
      </div>
      <div className="dashboard-grid">
         <Panel className="sales-panel"><div className="panel-heading"><div><h2>Sales at a glance</h2><p>Revenue across the {salesRange === 1 ? 'day' : `last ${salesRange} days`}</p></div><select className="period-select" value={salesRange} onChange={e => setSalesRange(Number(e.target.value))} aria-label="Sales chart time range" data-testid="select-sales-range"><option value={1}>Today</option><option value={7}>7 days</option><option value={30}>30 days</option></select></div>
           <div className="chart-amount">{currency(sales.reduce((a, s) => a + s.revenue, 0), settings.data?.currency)} <span>total sales</span></div>
           <div className="sales-chart" data-testid="chart-weekly-sales">{sales.map((s, i) => <div className="chart-column" key={`${s.label}-${i}`}><div className="chart-track"><div className="chart-bar" style={{ height: `${Math.max(s.revenue ? 12 : 4, s.revenue / maxSales * 100)}%` }}/></div><span>{s.label}</span></div>)}</div>
        </Panel>
        <Panel className="pipeline-panel"><div className="panel-heading"><div><h2>Order pipeline</h2><p>Know what needs a nudge</p></div><Link href="/orders" className="small-link">All orders <ArrowRight size={13}/></Link></div><div className="pipeline-total">{(data?.pipeline || []).reduce((a, p) => a + p.count, 0)} <span>orders in the flow</span></div><div className="pipeline-bars">{(data?.pipeline || []).map(p => <div key={p.status} className="pipeline-row"><span>{pretty(p.status)}</span><div className="pipeline-track"><i style={{ width: `${p.count / maxPipeline * 100}%` }}/></div><b>{p.count}</b></div>)}</div><Link href="/delivery" className="pipeline-foot"><Truck size={15}/> Check delivery progress <ArrowRight size={14}/></Link></Panel>
        <Panel className="top-products"><div className="panel-heading"><div><h2>Moving this week</h2><p>Your top products by orders</p></div><Link href="/products" className="small-link">View stock <ArrowRight size={13}/></Link></div>
          {(data?.topProducts || []).length ? data?.topProducts.map((p, i) => <div className="top-product-row" key={p.code}><span className={`product-rank rank-${i + 1}`}>{String(i + 1).padStart(2, '0')}</span><div className="top-product-thumb">{p.name.slice(0, 1)}</div><div className="top-product-copy"><b>{p.name}</b><small>{p.code}</small></div><strong>{p.sold} <small>sold</small></strong></div>) : <CompactEmpty label="No product sales yet"/>}
        </Panel>
        <Panel className="activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>A little pulse from the shop</p></div><Activity size={17} className="muted-icon"/></div><DataState loading={activity.isLoading} error={activity.isError} retry={() => activity.refetch()} empty={!activity.isLoading && !activity.data?.length} testId="activity">{activity.data?.slice(0, 5).map((a, i) => <div className="activity-row" key={a.id}><div className={`activity-marker marker-${i % 3}`}><Check size={13}/></div><div><b>{a.title}</b><small>{a.detail}</small><span>{a.channel} <i/> {a.time}</span></div></div>)}</DataState></Panel>
      </div>
    </DataState>
  </PageFrame>;
}
function Metric({ label, value, note, icon, tone }: { label: string; value: string | number; note: string; icon: ReactNode; tone: string }) {
  return <article className="metric-card" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="metric-top"><span>{label}</span><span className={`metric-icon tone-${tone}`}>{icon}</span></div><strong>{value}</strong><small>{note}</small></article>;
}
function CompactEmpty({ label }: { label: string }) { return <div className="compact-empty">{label}</div>; }

function CapturePage() {
  const qc = useQueryClient(); const q = useListCaptures(); const products = useListProducts(); const settings = useGetSettings(); const createCapture = useCreateCapture();
  const update = useUpdateCapture(); const confirm = useConfirmCapture();
  const [selected, setSelected] = useState<string | null>(null); const [filter, setFilter] = useState('all'); const [success, setSuccess] = useState('');
  const [captureModal, setCaptureModal] = useState(false); const [captureDraft, setCaptureDraft] = useState({ customerName: '', channel: 'Facebook', snippet: '' });
  const [reviewDraft, setReviewDraft] = useState({ customerName: '', phone: '', address: '', color: '', size: '', quantity: 1, deliveryFee: 0 });
  const captures = q.data || []; const active = captures.find(c => c.id === selected) || captures.find(c => c.status.toLowerCase() !== 'ordered') || captures[0];
  useEffect(() => {
    if (active) setReviewDraft({ customerName: active.customerName, phone: active.phone || '', address: active.address || '', color: active.color, size: active.size, quantity: active.quantity, deliveryFee: active.deliveryFee });
  }, [active?.id]);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListCapturesQueryKey() });
    qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
    qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTenhflowDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTenhflowActivityQueryKey() });
  };
  const updateField = (data: Partial<Capture>) => {
    if (!active || active.status.toLowerCase() === 'ordered') return;
    update.mutate({ id: active.id, data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListCapturesQueryKey() }); } });
  };
  const confirmNow = () => {
    if (!active || active.status.toLowerCase() === 'ordered') return;
    confirm.mutate({ id: active.id, data: { paymentMethod: settings.data?.defaultPaymentMethod || 'cash_on_delivery', deliveryMethod: 'Own Rider' } }, {
      onSuccess: () => { invalidate(); setSelected(null); setSuccess(`Order confirmed for ${active.customerName}.`); },
    });
  };
  const createFromMessage = (e: FormEvent) => { e.preventDefault(); createCapture.mutate({ data: captureDraft }, { onSuccess: suggestion => { qc.invalidateQueries({ queryKey: getListCapturesQueryKey() }); setSelected(suggestion.id); setCaptureModal(false); setCaptureDraft({ customerName: '', channel: 'Facebook', snippet: '' }); setSuccess('Message captured as a review suggestion. No order was confirmed.'); } }); };
  const filtered = captures.filter(c => filter === 'all' || /review|missing|info/i.test(c.status));
  const actionError = confirm.error?.message || update.error?.message || createCapture.error?.message;
  return <PageFrame title="Customer capture" subtitle="Review what the conversation already told us. Confirm when it looks right." action={<div className="capture-heading-actions"><div className="capture-counter"><span className="live-dot"/>{captures.filter(c => c.status.toLowerCase() !== 'ordered').length} to review</div><button className="button button-secondary" onClick={() => setCaptureModal(true)} data-testid="button-capture-message"><Plus size={15}/> Capture a message</button></div>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !captures.length} testId="captures">
      {success && <div className="success-banner" role="status" data-testid="status-capture-success"><CheckCircle2 size={17}/>{success}<button onClick={() => setSuccess('')} aria-label="Dismiss success"><X size={15}/></button><Link href="/orders">View orders <ArrowRight size={13}/></Link></div>}
      {actionError && <div className="missing-callout" role="alert" data-testid="status-capture-error"><CircleHelp size={15}/><span>{actionError}</span></div>}
      <div className="capture-workspace">
        <Panel className="capture-queue"><div className="queue-heading"><div><h2>Needs your review</h2><p>Extracted from recent conversations</p></div><button className="filter-button" onClick={() => setFilter(filter === 'all' ? 'review' : 'all')} data-testid="button-filter-captures"><Filter size={15}/>{filter === 'all' ? 'All' : 'Review'}</button></div>
          <div className="queue-list">{filtered.map(c => <button key={c.id} className={`capture-row ${active?.id === c.id ? 'capture-selected' : ''}`} onClick={() => { setSelected(c.id); setSuccess(''); }} data-testid={`card-capture-${c.id}`}>
            <div className={`channel-mark channel-${c.channel.toLowerCase().replaceAll(' ', '-')}`}>{c.channel.slice(0,1)}</div><div className="capture-row-content"><div className="capture-row-top"><b>{c.customerName}</b><time>{dateShort(c.createdAt)}</time></div><p>{c.snippet}</p><div className="capture-tags"><StatusPill value={c.status}/><span>{c.productName || 'Product not identified'}</span></div></div><ChevronRight size={16} className="queue-chevron"/>
          </button>)}</div>
          <div className="queue-footer"><span><ShieldCheck size={14}/> You confirm every order</span><span>{filtered.length} conversations</span></div>
        </Panel>
        {active ? <Panel className="review-panel"><div className="review-top"><div><span className="section-kicker">ORDER REVIEW</span><h2>Does this look right?</h2></div><span className={`confidence confidence-${active.confidence >= 85 ? 'high' : 'mid'}`}><Zap size={13}/>{active.confidence}% match</span></div>
          <div className="source-quote"><div className="quote-byline"><div className="avatar avatar-coral">{initials(active.customerName)}</div><div><b>{active.customerName}</b><small>{active.channel} · {active.createdAt ? new Date(active.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</small></div></div><p>“{active.snippet}”</p></div>
          {active.missing?.length > 0 && <div className="missing-callout"><CircleHelp size={15}/><span>Still needed: <b>{active.missing.join(', ')}</b></span></div>}
          <div className="review-fields"><div className="review-section-title"><span>ORDER DETAILS</span><small>Already pulled from chat</small></div><div className="field-grid">
            <Field label="Customer"><input value={reviewDraft.customerName} onChange={e => setReviewDraft({ ...reviewDraft, customerName: e.target.value })} onBlur={() => updateField({ customerName: reviewDraft.customerName })} data-testid="input-capture-customer"/></Field>
            <Field label="Phone"><input value={reviewDraft.phone} placeholder="Add phone if shared" onChange={e => setReviewDraft({ ...reviewDraft, phone: e.target.value })} onBlur={() => updateField({ phone: reviewDraft.phone || null })} data-testid="input-capture-phone"/></Field>
             <Field label="Product"><select value={active.productCode} onChange={e => updateField({ productCode: e.target.value })} data-testid="input-capture-product"><option value="">Choose a product</option>{active.productCode && !products.data?.some(p => p.code === active.productCode) && <option value={active.productCode}>Unmatched · {active.productCode}</option>}{products.data?.map(p => <option key={p.id} value={p.code}>{p.code} · {p.name}</option>)}</select></Field>
            <Field label="Product code"><input value={active.productCode} readOnly data-testid="input-capture-product-code"/></Field>
            <Field label="Color"><input value={reviewDraft.color} onChange={e => setReviewDraft({ ...reviewDraft, color: e.target.value })} onBlur={() => updateField({ color: reviewDraft.color })} data-testid="input-capture-color"/></Field>
            <Field label="Size"><input value={reviewDraft.size} onChange={e => setReviewDraft({ ...reviewDraft, size: e.target.value })} onBlur={() => updateField({ size: reviewDraft.size })} data-testid="input-capture-size"/></Field>
            <Field label="Quantity"><input type="number" min="1" value={reviewDraft.quantity} onChange={e => setReviewDraft({ ...reviewDraft, quantity: Math.max(1, Number(e.target.value)) })} onBlur={() => updateField({ quantity: reviewDraft.quantity })} data-testid="input-capture-quantity"/></Field>
            <Field label="Delivery fee"><input type="number" min="0" value={reviewDraft.deliveryFee} onChange={e => setReviewDraft({ ...reviewDraft, deliveryFee: Math.max(0, Number(e.target.value)) })} onBlur={() => updateField({ deliveryFee: reviewDraft.deliveryFee })} data-testid="input-capture-delivery-fee"/></Field>
            <Field label="Delivery address" full><input value={reviewDraft.address} placeholder="Add address when customer shares it" onChange={e => setReviewDraft({ ...reviewDraft, address: e.target.value })} onBlur={() => updateField({ address: reviewDraft.address || null })} data-testid="input-capture-address"/></Field>
          </div></div>
          <div className="review-total"><span>{active.quantity} item{active.quantity === 1 ? '' : 's'} · {currency(active.unitPrice, settings.data?.currency)} each</span><div><small>Estimated total</small><b>{currency(active.quantity * active.unitPrice + active.deliveryFee, settings.data?.currency)}</b></div></div>
          <div className="review-actions"><button className="button button-secondary" onClick={() => updateField({ status: 'Needs Review' })} disabled={update.isPending || active.status.toLowerCase() === 'ordered'} data-testid="button-capture-needs-info">Needs more info</button><button className="button button-primary" onClick={confirmNow} disabled={confirm.isPending || update.isPending || active.status.toLowerCase() === 'ordered'} data-testid="button-confirm-capture">{confirm.isPending ? 'Confirming…' : active.status.toLowerCase() === 'ordered' ? 'Order already created' : <><Check size={16}/> Confirm order</>}</button></div><p className="no-send-note"><ShieldCheck size={13}/> This records your order. It does not send a message.</p>
        </Panel> : <Panel className="review-panel"><div className="empty-surface"><div className="empty-icon"><CheckCircle2/></div><b>Queue is clear</b><span>Everything here has been reviewed.</span></div></Panel>}
      </div>
    </DataState>
    {captureModal && <Modal title="Capture a customer message" onClose={() => setCaptureModal(false)}><form onSubmit={createFromMessage} className="form-stack"><p className="modal-intro">Paste a buyer’s message and choose where it came from. TenhFlow will prepare a suggestion for you to review; it will not create or confirm an order automatically.</p><Field label="Customer name"><input required value={captureDraft.customerName} onChange={e => setCaptureDraft({ ...captureDraft, customerName: e.target.value })} placeholder="Name shown in the conversation" data-testid="input-new-capture-customer"/></Field><Field label="Channel"><select value={captureDraft.channel} onChange={e => setCaptureDraft({ ...captureDraft, channel: e.target.value })} data-testid="select-new-capture-channel">{['Facebook', 'Messenger', 'Telegram', 'Livestream'].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Customer message"><textarea required rows={4} value={captureDraft.snippet} onChange={e => setCaptureDraft({ ...captureDraft, snippet: e.target.value })} placeholder="Paste the message here…" data-testid="input-new-capture-message"/></Field><div className="capture-suggestion-note"><ShieldCheck size={15}/> New captures are suggestions only. Review details before confirming.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCaptureModal(false)}>Cancel</button><button className="button button-primary" disabled={createCapture.isPending} data-testid="button-submit-capture-message">{createCapture.isPending ? 'Preparing suggestion…' : 'Prepare review suggestion'}</button></div></form></Modal>}
  </PageFrame>;
}

function InboxPage() {
  const qc = useQueryClient(); const q = useListConversations(); const update = useUpdateConversation();
  const [selectedId, setSelectedId] = useState<string | null>(null); const [search, setSearch] = useState('');
  const list = q.data || []; const filtered = list.filter(c => c.customerName.toLowerCase().includes(search.toLowerCase()) || c.snippet.toLowerCase().includes(search.toLowerCase()));
  const active = list.find(c => c.id === selectedId) || filtered[0];
  const changeCategory = (category: string) => active && update.mutate({ id: active.id, data: { category } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListConversationsQueryKey() }) });
  return <PageFrame title="Inbox" subtitle="Triage conversations and turn buying intent into a capture." action={<Link href="/capture" className="button button-primary"><Zap size={15}/> Open capture queue</Link>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !list.length} testId="inbox">
      <div className="inbox-layout"><Panel className="inbox-list"><div className="inbox-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a conversation" data-testid="input-search-inbox"/></div><div className="inbox-list-items">{filtered.map(c => <button key={c.id} onClick={() => setSelectedId(c.id)} className={`inbox-item ${active?.id === c.id ? 'inbox-item-active' : ''}`} data-testid={`card-conversation-${c.id}`}><div className="channel-mark">{c.channel.slice(0,1)}</div><div className="inbox-item-copy"><div><b>{c.customerName}</b><time>{c.time}</time></div><p>{c.snippet}</p><div className="capture-tags"><span>{c.channel}</span><StatusPill value={c.category}/></div></div></button>)}</div></Panel>
      {active ? <Panel className="conversation-panel"><div className="conversation-header"><div className="avatar avatar-coral">{initials(active.customerName)}</div><div><b>{active.customerName}</b><small>{active.channel} · conversation</small></div><div className="conversation-category"><label htmlFor="category-select">Category</label><select id="category-select" value={active.category} onChange={e => changeCategory(e.target.value)} data-testid="select-conversation-category">{['new', 'interested', 'order_intent', 'follow_up', 'closed'].map(c => <option key={c} value={c}>{pretty(c)}</option>)}</select></div></div><div className="chat-body">{active.messages?.length ? active.messages.map(m => <div key={m.id} className={`chat-message ${m.sender.toLowerCase() === 'shop' || m.sender.toLowerCase() === 'seller' ? 'chat-outgoing' : ''}`}><span>{m.sender}</span><p>{m.text}</p><time>{m.time}</time></div>) : <div className="chat-quiet"><MessageSquareText size={20}/><span>Conversation preview</span><p>{active.snippet}</p></div>}</div><div className="detected-box"><div><span className="section-kicker">BUYING DETAILS FOUND</span><b>{active.productCode || 'No product matched'}{active.color ? ` · ${active.color}` : ''}{active.size ? ` · ${active.size}` : ''}</b><small>Quantity: {active.quantity || 'Not specified'}</small></div><Link href="/capture" className="button button-primary" data-testid="button-conversation-capture"><Zap size={14}/> Review capture</Link></div><div className="inbox-no-send"><ShieldCheck size={14}/> This inbox is for sales processing. TenhFlow does not send messages.</div></Panel> : <Panel className="conversation-panel"><CompactEmpty label="No matching conversation"/></Panel>}</div>
    </DataState>
  </PageFrame>;
}

function OrdersPage() {
  const q = useListOrders(); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all');
  const list = (q.data || []).filter(o => (status === 'all' || o.status === status) && `${o.customerName} ${o.id} ${o.productName}`.toLowerCase().includes(search.toLowerCase()));
  return <PageFrame title="Orders" subtitle="A clear view from confirmed to delivered." action={<Link href="/capture" className="button button-primary"><Plus size={16}/> Review captures</Link>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.data?.length} testId="orders"><div className="toolbar"><div className="search-control"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders or customers" data-testid="input-search-orders"/></div><select value={status} onChange={e => setStatus(e.target.value)} data-testid="select-order-status"><option value="all">All statuses</option>{[...new Set(q.data?.map(o => o.status) || [])].map(s => <option key={s} value={s}>{pretty(s)}</option>)}</select><span className="result-count">{list.length} orders</span></div>
      {list.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Item</th><th>Total</th><th>Payment</th><th>Status</th><th>Channel</th><th/></tr></thead><tbody>{list.map(o => <tr key={o.id} data-testid={`row-order-${o.id}`}><td><Link className="id-link" href={`/orders/${o.id}`}>{o.id}</Link><small>{dateShort(o.createdAt)}</small></td><td><b>{o.customerName}</b><small>{o.phone || 'No phone'}</small></td><td><b>{o.productName}</b><small>{o.color} · {o.size} · qty {o.quantity}</small></td><td><b>{currency(o.total)}</b><small>incl. delivery</small></td><td><StatusPill value={o.paymentStatus}/></td><td><StatusPill value={o.status}/></td><td>{o.channel}</td><td><Link className="row-link" href={`/orders/${o.id}`} aria-label={`Open order ${o.id}`} data-testid={`link-order-${o.id}`}><ChevronRight size={16}/></Link></td></tr>)}</tbody></table></div> : <CompactEmpty label="No orders match those filters"/>}
    </DataState>
  </PageFrame>;
}

function OrderDetailPage({ id }: { id?: string }) {
  const order = useGetOrder(id || '', { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id || '') } }); const qc = useQueryClient(); const update = useUpdateOrder();
  if (!id) return <Redirect to="/orders"/>;
  const o = order.data;
  const mutate = (data: { status?: string; paymentStatus?: string; paid?: number; deliveryStatus?: string }) => {
    if (!o) return;
    update.mutate({ id: o.id, data }, { onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetOrderQueryKey(o.id) });
      qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTenhflowDashboardQueryKey() });
    } });
  };
  return <PageFrame title={o ? `Order ${o.id}` : 'Order details'} subtitle="Update status and keep the customer’s order moving." action={<Link href="/orders" className="button button-secondary"><ArrowLeft size={15}/> All orders</Link>}>
    <DataState loading={order.isLoading} error={order.isError} retry={() => order.refetch()} testId="order-detail">
      {o && <div className="detail-grid">
        <Panel className="detail-main">
          <div className="detail-header"><div><span className="section-kicker">ORDER PLACED {dateShort(o.createdAt)}</span><h2>{o.customerName}</h2><p>{o.channel} · {o.phone || 'No phone provided'}</p></div><StatusPill value={o.status}/></div>
          <div className="detail-product"><div className="detail-product-icon"><ShoppingBag size={20}/></div><div><b>{o.productName}</b><small>{o.productCode} · {o.color} · size {o.size} · qty {o.quantity}</small></div><strong>{currency(o.subtotal)}</strong></div>
          <div className="detail-address"><div><span>DELIVERY ADDRESS</span><b>{o.address || 'Address not provided'}</b></div><div><span>DELIVERY METHOD</span><b>{pretty(o.deliveryMethod)} {o.rider ? `· ${o.rider}` : ''}</b></div></div>
          <div className="detail-total"><span>Subtotal</span><b>{currency(o.subtotal)}</b><span>Delivery</span><b>{currency(o.deliveryFee)}</b><span className="total-label">Total</span><b className="total-value">{currency(o.total)}</b></div>
        </Panel>
        <Panel className="detail-side">
          <h2>Order controls</h2>
          <label className="control-label">Order status<select value={o.status} onChange={e => mutate({ status: e.target.value })} data-testid="select-order-status-detail">{['New', 'Confirmed', 'Packing', 'Ready', 'Out for Delivery', 'Delivered', 'Failed Delivery', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="control-label">Delivery status<select value={o.deliveryStatus} onChange={e => mutate({ deliveryStatus: e.target.value })} data-testid="select-order-delivery-status">{['Pending', 'Assigned', 'Out for Delivery', 'Delivered', 'Failed'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="control-label">Payment status<select value={o.paymentStatus} onChange={e => { const status = e.target.value; mutate({ paymentStatus: status, ...(status === 'Paid' ? { paid: o.total } : status === 'Pending' ? { paid: 0 } : {}) }); }} data-testid="select-order-payment-status">{['Pending', 'Partial', 'Paid'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <div className="payment-progress"><span>Collected so far</span><b>{currency(o.paid)} / {currency(o.total)}</b></div>
          <div className="quick-actions"><button className="button button-primary" onClick={() => mutate({ paid: o.total, paymentStatus: 'Paid' })} disabled={update.isPending || o.paid >= o.total} data-testid="button-mark-paid"><Check size={15}/> Mark fully paid</button></div>
          <small className="quiet-note">Saving these changes updates the order record.</small>
        </Panel>
      </div>}
    </DataState>
  </PageFrame>;
}

function CustomersPage() {
  const qc = useQueryClient(); const q = useListCustomers(); const create = useCreateCustomer(); const [search, setSearch] = useState(''); const [modal, setModal] = useState(false); const [form, setForm] = useState({ name: '', phone: '', address: '', platform: 'Facebook', notes: '' }); const [notice, setNotice] = useState('');
  const list = (q.data || []).filter(c => `${c.name} ${c.phone} ${c.address}`.toLowerCase().includes(search.toLowerCase()));
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: form }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }); setModal(false); setForm({ name: '', phone: '', address: '', platform: 'Facebook', notes: '' }); setNotice('Customer added.'); } }); };
  return <PageFrame title="Customers" subtitle="Keep the people behind the orders close at hand." action={<button className="button button-primary" onClick={() => setModal(true)} data-testid="button-add-customer"><Plus size={16}/> Add customer</button>}>
    {notice && <div className="success-banner" data-testid="status-customer-success"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.data?.length} testId="customers"><div className="toolbar"><div className="search-control"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers" data-testid="input-search-customers"/></div><span className="result-count">{list.length} customers</span></div><div className="customer-grid">{list.map(c => <Link className="customer-card" href={`/customers/${c.id}`} key={c.id} data-testid={`card-customer-${c.id}`}><div className="customer-card-top"><div className="avatar avatar-teal">{initials(c.name)}</div><span>{c.platform}</span></div><b>{c.name}</b><small>{c.phone || 'No phone added'}</small><div className="customer-stats"><span><strong>{c.totalOrders}</strong> orders</span><span><strong>{Math.round(c.reliability)}%</strong> reliable</span><span><strong>{currency(c.totalSpent)}</strong> spent</span></div><div className="customer-card-foot">Customer since {dateShort(c.since)} <ArrowRight size={14}/></div></Link>)}</div></DataState>
    {modal && <Modal title="Add a customer" onClose={() => setModal(false)}><form onSubmit={submit} className="form-stack"><Field label="Customer name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-customer-name"/></Field><Field label="Phone number"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-customer-phone"/></Field><Field label="Address"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-customer-address"/></Field><Field label="Usually messages from"><select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} data-testid="select-customer-platform">{['Facebook', 'Messenger', 'Telegram', 'Livestream'].map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-customer-notes"/></Field><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={create.isPending} data-testid="button-save-customer">{create.isPending ? 'Saving…' : 'Add customer'}</button></div></form></Modal>}
  </PageFrame>;
}

function CustomerDetailPage({ id }: { id?: string }) {
  const qc = useQueryClient(); const query = useGetCustomer(id || '', { query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id || '') } });
  const update = useUpdateCustomer(); const c = query.data; const [notes, setNotes] = useState(''); const [ready, setReady] = useState(false);
  useEffect(() => { if (c && !ready) { setNotes(c.notes); setReady(true); } }, [c, ready]);
  const saveNotes = () => c && update.mutate({ id: c.id, data: { notes } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(c.id) }) });
  return <PageFrame title={c?.name || 'Customer profile'} subtitle="A useful little history of who comes back." action={<Link href="/customers" className="button button-secondary"><ArrowLeft size={15}/> Customers</Link>}>
    <DataState loading={query.isLoading} error={query.isError} retry={() => query.refetch()} testId="customer-detail">{c && <div className="detail-grid"><Panel className="detail-main"><div className="customer-profile-head"><div className="avatar avatar-teal avatar-large">{initials(c.name)}</div><div><span className="section-kicker">CUSTOMER SINCE {dateShort(c.since)}</span><h2>{c.name}</h2><p>{c.phone || 'No phone'} · {c.platform}</p></div></div><div className="customer-metric-strip"><Metric label="Orders" value={c.totalOrders} note={`${c.delivered} delivered`} icon={<ShoppingBag size={17}/>} tone="teal"/><Metric label="Total spent" value={currency(c.totalSpent)} note="All orders" icon={<Banknote size={17}/>} tone="amber"/><Metric label="Reliability" value={`${Math.round(c.reliability)}%`} note={`${c.cancelled} cancelled`} icon={<ShieldCheck size={17}/>} tone="blue"/></div><div className="profile-history"><h3>Order history</h3>{c.orders?.length ? c.orders.map(o => <Link href={`/orders/${o.id}`} key={o.id} className="history-row"><div><b>{o.id} · {o.productName}</b><small>{dateShort(o.createdAt)} · {o.color}, {o.size}</small></div><span>{currency(o.total)}</span><StatusPill value={o.status}/></Link>) : <CompactEmpty label="No orders to show yet"/>}</div></Panel><Panel className="detail-side"><h2>Customer details</h2><div className="profile-info"><span>Phone</span><b>{c.phone || 'Not added'}</b><span>Address</span><b>{c.address || 'Not added'}</b><span>First channel</span><b>{c.platform}</b><span>Pending orders</span><b>{c.pending}</b></div><label className="control-label">Shop notes<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} data-testid="input-customer-profile-notes"/></label><button className="button button-primary full-width" onClick={saveNotes} disabled={update.isPending} data-testid="button-save-customer-notes">{update.isPending ? 'Saving…' : 'Save notes'}</button></Panel></div>}</DataState>
  </PageFrame>;
}

function ProductsPage() {
  const qc = useQueryClient(); const q = useListProducts(); const create = useCreateProduct(); const update = useUpdateProduct(); const [modal, setModal] = useState(false); const [edit, setEdit] = useState<Product | null>(null); const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', price: 0, stock: 0, category: '', colors: '', sizes: '' });
  const open = (p?: Product) => { setEdit(p || null); setForm(p ? { name: p.name, code: p.code, price: p.price, stock: p.stock, category: p.category, colors: p.colors.join(', '), sizes: p.sizes.join(', ') } : { name: '', code: '', price: 0, stock: 0, category: '', colors: '', sizes: '' }); setModal(true); };
  const list = (q.data || []).filter(p => `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  const save = (e: FormEvent) => { e.preventDefault(); const data = { ...form, colors: form.colors.split(',').map(x => x.trim()).filter(Boolean), sizes: form.sizes.split(',').map(x => x.trim()).filter(Boolean), price: Number(form.price), stock: Number(form.stock) };
    const done = () => { qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); setModal(false); };
    if (edit) update.mutate({ id: edit.id, data }, { onSuccess: done }); else create.mutate({ data }, { onSuccess: done });
  };
  const setActive = (p: Product) => update.mutate({ id: p.id, data: { active: !p.active } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProductsQueryKey() }) });
  return <PageFrame title="Products & stock" subtitle="A compact catalog, with stock levels you can trust." action={<button className="button button-primary" onClick={() => open()} data-testid="button-add-product"><Plus size={16}/> Add product</button>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.data?.length} testId="products"><div className="toolbar"><div className="search-control"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your products" data-testid="input-search-products"/></div><span className="result-count">{list.length} products</span></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Category</th><th>Price</th><th>Stock</th><th>Colors & sizes</th><th>Availability</th><th/></tr></thead><tbody>{list.map(p => <tr key={p.id} data-testid={`row-product-${p.id}`}><td><div className="product-cell"><div className="top-product-thumb">{p.name.slice(0, 1)}</div><b>{p.name}</b></div></td><td className="mono">{p.code}</td><td>{p.category || '—'}</td><td><b>{currency(p.price)}</b></td><td><span className={p.stock <= 5 ? 'stock-low' : ''}>{p.stock} units</span></td><td>{p.colors.join(', ') || '—'}<small>{p.sizes.join(', ')}</small></td><td><StatusPill value={p.active ? 'active' : 'inactive'}/></td><td><button className="row-edit" onClick={() => open(p)} data-testid={`button-edit-product-${p.id}`}>Edit</button><button className="row-edit" onClick={() => setActive(p)} data-testid={`button-toggle-product-${p.id}`}>{p.active ? 'Pause' : 'Activate'}</button></td></tr>)}</tbody></table></div></DataState>
    {modal && <Modal title={edit ? 'Edit product' : 'Add a product'} onClose={() => setModal(false)}><form onSubmit={save} className="form-stack"><div className="form-two"><Field label="Product name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-product-name"/></Field><Field label="Product code"><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="input-product-code"/></Field></div><div className="form-two"><Field label="Price (USD)"><input type="number" min="0" step=".01" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} data-testid="input-product-price"/></Field><Field label="Stock count"><input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} data-testid="input-product-stock"/></Field></div><Field label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="input-product-category"/></Field><Field label="Colors (comma-separated)"><input value={form.colors} onChange={e => setForm({ ...form, colors: e.target.value })} placeholder="Sage, Sand, Ink" data-testid="input-product-colors"/></Field><Field label="Sizes (comma-separated)"><input value={form.sizes} onChange={e => setForm({ ...form, sizes: e.target.value })} placeholder="S, M, L" data-testid="input-product-sizes"/></Field><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={create.isPending || update.isPending} data-testid="button-save-product">{create.isPending || update.isPending ? 'Saving…' : 'Save product'}</button></div></form></Modal>}
  </PageFrame>;
}

function DeliveryPage() {
  const qc = useQueryClient(); const q = useListDeliveries(); const update = useUpdateDelivery(); const [search, setSearch] = useState('');
  const list = (q.data || []).filter(d => `${d.customerName} ${d.orderId} ${d.address}`.toLowerCase().includes(search.toLowerCase()));
  const save = (id: string, data: { status?: string; method?: string; rider?: string | null }) => update.mutate({ id, data }, { onSuccess: () => {
    qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTenhflowDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  } });
  return <PageFrame title="Delivery" subtitle="Assign a rider and follow each handoff through." action={<span className="read-only-tag"><Truck size={14}/> Delivery board</span>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.data?.length} testId="delivery">
      <div className="toolbar"><div className="search-control"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deliveries" data-testid="input-search-deliveries"/></div><span className="result-count">{list.length} deliveries</span></div>
      <div className="delivery-grid">{list.map(d => <Panel key={d.id} className="delivery-card">
        <div className="delivery-card-top"><Link className="id-link" href={`/orders/${d.orderId}`}>{d.orderId}</Link><StatusPill value={d.status}/></div><h3>{d.customerName}</h3><p>{d.phone || 'No phone'} · {d.address || 'No address added'}</p>
        <div className="delivery-meta"><span>Method</span><select value={d.method} onChange={e => save(d.id, { method: e.target.value })} data-testid={`select-delivery-method-${d.id}`}>{[...new Set([d.method, 'Own Rider', 'Third-party courier', 'Customer pickup'])].map(m => <option key={m} value={m}>{pretty(m)}</option>)}</select><span>Rider</span><input defaultValue={d.rider || ''} placeholder="Assign rider" onBlur={e => save(d.id, { rider: e.target.value || null })} data-testid={`input-delivery-rider-${d.id}`}/><span>Fee</span><b>{currency(d.fee)}</b></div>
        <label className="control-label">Delivery status<select value={d.status} onChange={e => save(d.id, { status: e.target.value })} data-testid={`select-delivery-status-${d.id}`}>{['Pending', 'Assigned', 'Out for Delivery', 'Delivered', 'Failed'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      </Panel>)}</div>
      {update.error && <div className="missing-callout" role="alert" data-testid="status-delivery-error"><CircleHelp size={15}/><span>{update.error.message}</span></div>}
    </DataState>
  </PageFrame>;
}

function PaymentsPage() {
  const qc = useQueryClient(); const q = useListPayments(); const update = useUpdatePayment(); const [search, setSearch] = useState('');
  const list = (q.data || []).filter(p => `${p.customerName} ${p.orderId} ${p.method}`.toLowerCase().includes(search.toLowerCase()));
  const save = (id: string, data: { paid?: number; method?: string; status?: string }) => update.mutate({ id, data }, { onSuccess: () => {
    qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
    qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetTenhflowDashboardQueryKey() });
  } });
  return <PageFrame title="Payments" subtitle="Keep track of what’s collected and what’s still on the way." action={<span className="read-only-tag"><CreditCard size={14}/> Payment overview</span>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.isLoading && !q.data?.length} testId="payments">
      <div className="payment-summary">{[ ['To collect', (q.data || []).reduce((s, p) => s + p.remaining, 0)], ['Collected', (q.data || []).reduce((s, p) => s + p.paid, 0)], ['Payment records', q.data?.length || 0] ].map(([l, v]) => <div key={String(l)}><span>{l}</span><b>{typeof v === 'number' && l !== 'Payment records' ? currency(v) : v}</b></div>)}</div>
      <div className="toolbar"><div className="search-control"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments" data-testid="input-search-payments"/></div><span className="result-count">{list.length} records</span></div>
      <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Action</th></tr></thead><tbody>{list.map(p => <tr key={p.id} data-testid={`row-payment-${p.id}`}><td><Link href={`/orders/${p.orderId}`} className="id-link">{p.orderId}</Link><small>{dateShort(p.createdAt)}</small></td><td><b>{p.customerName}</b></td><td><select value={p.method} onChange={e => save(p.id, { method: e.target.value })} data-testid={`select-payment-method-${p.id}`}>{[...new Set([p.method, 'COD', 'cash_on_delivery', 'Cash', 'cash', 'Bank Transfer', 'bank_transfer', 'ABA', 'aba', 'KHQR'])].map(m => <option key={m} value={m}>{pretty(m)}</option>)}</select></td><td>{currency(p.total)}</td><td>{currency(p.paid)}</td><td><b>{currency(p.remaining)}</b></td><td><StatusPill value={p.status}/></td><td><button className="row-edit" onClick={() => save(p.id, { paid: p.total, status: 'Paid' })} disabled={p.remaining <= 0 || update.isPending} data-testid={`button-collect-payment-${p.id}`}>{p.remaining <= 0 ? 'Collected' : 'Mark paid'}</button></td></tr>)}</tbody></table></div>
      {update.error && <div className="missing-callout" role="alert" data-testid="status-payment-error"><CircleHelp size={15}/><span>{update.error.message}</span></div>}
    </DataState>
  </PageFrame>;
}

function SettingsPage() {
  const qc = useQueryClient(); const q = useGetSettings(); const update = useUpdateSettings(); const settings = q.data;
  const [form, setForm] = useState({ shopName: '', category: '', phone: '', address: '', currency: 'USD', defaultDeliveryFee: 0, defaultPaymentMethod: 'cash_on_delivery', orderPrefix: 'TF', appearance: 'light' });
  const [initialized, setInitialized] = useState(false); const [saved, setSaved] = useState(false);
  useEffect(() => { if (settings && !initialized) { setForm({ shopName: settings.shopName, category: settings.category, phone: settings.phone, address: settings.address, currency: settings.currency, defaultDeliveryFee: settings.defaultDeliveryFee, defaultPaymentMethod: settings.defaultPaymentMethod, orderPrefix: settings.orderPrefix, appearance: settings.appearance }); setThemePreference(settings.appearance === 'dark' ? 'dark' : 'light'); setInitialized(true); } }, [settings, initialized]);
  useEffect(() => { if (initialized) setThemePreference(form.appearance === 'dark' ? 'dark' : 'light'); }, [form.appearance, initialized]);
  const save = (e: FormEvent) => { e.preventDefault(); update.mutate({ data: form }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); setSaved(true); } }); };
  const channels = settings?.channels || [];
  return <PageFrame title="Settings" subtitle="Your shop defaults and channel connection states." action={<button className="button button-primary" onClick={() => document.querySelector<HTMLFormElement>('#settings-form')?.requestSubmit()} disabled={update.isPending} data-testid="button-save-settings"><Check size={15}/>{update.isPending ? 'Saving…' : 'Save changes'}</button>}>
    <DataState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} testId="settings">{saved && <div className="success-banner" data-testid="status-settings-saved"><CheckCircle2 size={16}/>Settings saved.<button onClick={() => setSaved(false)}><X size={15}/></button></div>}<div className="settings-layout"><form className="settings-form" id="settings-form" onSubmit={save}><Panel><div className="settings-section-head"><div><h2>Shop profile</h2><p>These details stay with your shop’s orders.</p></div><div className="section-icon"><ShoppingBag size={17}/></div></div><div className="form-two"><Field label="Shop name"><input value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} required data-testid="input-settings-shop-name"/></Field><Field label="Category"><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="input-settings-category"/></Field></div><div className="form-two"><Field label="Shop phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-settings-phone"/></Field><Field label="Order prefix"><input value={form.orderPrefix} onChange={e => setForm({ ...form, orderPrefix: e.target.value })} data-testid="input-settings-prefix"/></Field></div><Field label="Shop address"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-settings-address"/></Field></Panel><Panel><div className="settings-section-head"><div><h2>Order defaults</h2><p>Good starting points, always editable per order.</p></div><div className="section-icon"><ListChecks size={17}/></div></div><div className="form-two"><Field label="Currency"><select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} data-testid="select-settings-currency"><option value="USD">US Dollar (USD)</option><option value="KHR">Cambodian Riel (KHR)</option></select></Field><Field label="Default delivery fee"><input type="number" min="0" value={form.defaultDeliveryFee} onChange={e => setForm({ ...form, defaultDeliveryFee: Number(e.target.value) })} data-testid="input-settings-delivery-fee"/></Field></div><Field label="Default payment method"><select value={form.defaultPaymentMethod} onChange={e => setForm({ ...form, defaultPaymentMethod: e.target.value })} data-testid="select-settings-payment"><option value="cash_on_delivery">Cash on delivery</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="aba">ABA</option></select></Field></Panel></form><div className="settings-aside"><Panel><div className="settings-section-head"><div><h2>Social channels</h2><p>Connection setup at a glance.</p></div><div className="section-icon"><MessageSquareText size={17}/></div></div><div className="channel-settings">{channels.length ? channels.map(ch => <div className="channel-setting" key={ch.name}><div className="channel-mark">{ch.name.slice(0,1)}</div><div><b>{ch.name}</b><small>{ch.description}</small></div><span className={`connection-state ${/connected/i.test(ch.state) ? 'connected' : ''}`}><i/>{pretty(ch.state)}</span></div>) : ['Facebook', 'Messenger', 'Telegram', 'Livestream'].map(n => <div className="channel-setting" key={n}><div className="channel-mark">{n.slice(0,1)}</div><div><b>{n}</b><small>Setup not connected</small></div><span className="connection-state"><i/>Not connected</span></div>)}</div><p className="channel-disclaimer"><ShieldCheck size={14}/> No real messages are sent or received until a channel is connected.</p></Panel><Panel><div className="settings-section-head"><div><h2>Appearance</h2><p>Pick a comfortable workspace theme.</p></div><div className="section-icon"><Sun size={17}/></div></div><div className="appearance-options"><button className={`appearance-option ${form.appearance === 'light' ? 'appearance-selected' : ''}`} onClick={() => setForm({ ...form, appearance: 'light' })} type="button" data-testid="button-appearance-light"><Sun size={16}/> Light <span>{form.appearance === 'light' && <Check size={14}/>}</span></button><button className={`appearance-option ${form.appearance === 'dark' ? 'appearance-selected' : ''}`} onClick={() => setForm({ ...form, appearance: 'dark' })} type="button" data-testid="button-appearance-dark"><Moon size={16}/> Dark <span>{form.appearance === 'dark' && <Check size={14}/>}</span></button></div><small className="quiet-note">Use the top bar theme toggle to preview. Save to keep your preference with shop settings.</small></Panel></div></div></DataState>
  </PageFrame>;
}

function OnboardingPage() {
  const qc = useQueryClient(); const q = useGetSettings(); const update = useUpdateSettings();
  const [step, setStep] = useState(0); const [shopName, setShopName] = useState(q.data?.shopName || ''); const [category, setCategory] = useState(q.data?.category || 'Fashion & accessories'); const [productName, setProductName] = useState(''); const [code, setCode] = useState(''); const [price, setPrice] = useState(''); const createProduct = useCreateProduct();
  useEffect(() => { if (q.data && !shopName) { setShopName(q.data.shopName); setCategory(q.data.category || 'Fashion & accessories'); } }, [q.data, shopName]);
  const create = () => update.mutate({ data: { shopName, category, onboarded: true } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); setStep(2); } });
  const skipSetup = () => update.mutate({ data: { shopName: shopName || q.data?.shopName || 'My shop', category, onboarded: true } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); setStep(4); } });
  const finish = (e: FormEvent) => { e.preventDefault(); createProduct.mutate({ data: { name: productName, code, price: Number(price), stock: 0, category, colors: [], sizes: [] } }, { onSuccess: () => { update.mutate({ data: { shopName, category, onboarded: true } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); setStep(4); } }); } }); };
  return <div className="onboarding-page"><header><Link href="/dashboard" className="brand-link"><Brand/></Link><button className="onboard-skip" onClick={skipSetup} disabled={update.isPending} data-testid="button-skip-onboarding">Set up later <ArrowRight size={14}/></button></header><main className="onboarding-main"><div className="onboard-steps">{['Welcome', 'Shop details', 'Channels', 'First product'].map((s, i) => <div key={s} className={`onboard-step ${i <= step ? 'onboard-step-active' : ''}`}><span>{i < step ? <Check size={13}/> : i + 1}</span>{s}</div>)}</div>{step === 0 && <div className="onboard-card"><div className="onboard-art"><Brand compact/><div className="onboard-chat"><MessageSquareText size={17}/><span>“Yes, the blue one in M.”</span></div><ArrowRight className="onboard-arrow"/><div className="onboard-order"><CheckCircle2 size={18}/><span>Ready to review</span></div></div><span className="section-kicker">WELCOME TO TENHFLOW</span><h1>Your conversations<br/><em>are full of orders.</em></h1><p>Let’s make them easier to keep track of. Your shop can be ready in just a few short steps.</p><button className="button button-primary button-large" onClick={() => setStep(1)} data-testid="button-onboarding-start">Let’s set up your shop <ArrowRight size={16}/></button></div>}
      {step === 1 && <div className="onboard-card"><span className="section-kicker">STEP 1 OF 3</span><h1>Tell us about<br/><em>your shop.</em></h1><p>This helps TenhFlow use the right defaults when you confirm an order.</p><div className="form-stack onboard-form"><Field label="Shop name"><input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Little Loom Phnom Penh" data-testid="input-onboarding-shop-name"/></Field><Field label="What do you sell?"><select value={category} onChange={e => setCategory(e.target.value)} data-testid="select-onboarding-category">{['Fashion & accessories', 'Beauty & personal care', 'Home & living', 'Food & beverage', 'Other'].map(c => <option key={c}>{c}</option>)}</select></Field><button className="button button-primary button-large" onClick={create} disabled={!shopName || update.isPending} data-testid="button-onboarding-shop-next">{update.isPending ? 'Saving…' : 'Continue'} <ArrowRight size={16}/></button></div></div>}
      {step === 2 && <div className="onboard-card"><span className="section-kicker">STEP 2 OF 3</span><h1>Your social<br/><em>channels.</em></h1><p>These are setup states only. Connect channels later from Settings; TenhFlow won’t send or receive messages until then.</p><div className="onboard-channels">{(q.data?.channels || [{ name: 'Facebook', state: 'not_connected', description: 'Not connected yet' }, { name: 'Messenger', state: 'not_connected', description: 'Not connected yet' }, { name: 'Telegram', state: 'not_connected', description: 'Not connected yet' }, { name: 'Livestream', state: 'not_connected', description: 'Manual capture supported' }]).map(ch => <div className="onboard-channel" key={ch.name}><div className="channel-mark">{ch.name.slice(0,1)}</div><div><b>{ch.name}</b><small>{ch.description}</small></div><span className="connection-state"><i/>{pretty(ch.state)}</span></div>)}</div><button className="button button-primary button-large" onClick={() => setStep(3)} data-testid="button-onboarding-channel-next">Continue to first product <ArrowRight size={16}/></button></div>}
      {step === 3 && <div className="onboard-card"><span className="section-kicker">STEP 3 OF 3</span><h1>Add your first<br/><em>product.</em></h1><p>You can start with the essentials. Variants and stock can be added anytime.</p><form onSubmit={finish} className="form-stack onboard-form"><Field label="Product name"><input required value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Linen co-ord set" data-testid="input-onboarding-product"/></Field><div className="form-two"><Field label="Product code"><input required value={code} onChange={e => setCode(e.target.value)} placeholder="LIN-01" data-testid="input-onboarding-code"/></Field><Field label="Price (USD)"><input required type="number" min="0" step=".01" value={price} onChange={e => setPrice(e.target.value)} data-testid="input-onboarding-price"/></Field></div><button className="button button-primary button-large" disabled={createProduct.isPending} data-testid="button-onboarding-finish">{createProduct.isPending ? 'Saving…' : 'Finish setup'} <Check size={16}/></button></form></div>}
      {step === 4 && <div className="onboard-card onboard-finished"><div className="finish-mark"><Check size={27}/></div><span className="section-kicker">YOU’RE READY</span><h1>Let’s make the<br/><em>next order easier.</em></h1><p>Your shop workspace is ready. When the first message arrives, TenhFlow will help you review the details before you confirm.</p><Link className="button button-primary button-large" href="/dashboard" data-testid="link-onboarding-dashboard">Go to your overview <ArrowRight size={16}/></Link></div>}</main><footer className="onboarding-footer"><ShieldCheck size={15}/> Your shop data stays yours. Channel states are never shown as connected unless they are.</footer></div>;
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`field ${full ? 'field-full' : ''}`}><span>{label}</span>{children}</label>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog" data-testid="button-close-modal"><X size={18}/></button></div>{children}</section></div>;
}
function CaptureCount() { const q = useListCaptures(); return q.data?.filter(c => c.status.toLowerCase() !== 'ordered').length || ''; }

function AppRoutes() {
  const [, setLocation] = useLocation();
  return <Switch>
    <Route path="/" component={Home}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/sign-up/*?" component={SignUpPage}/>
    <Route path="/onboarding"><Guard><OnboardingPage/></Guard></Route>
    <Route path="/dashboard"><Guard><DashboardPage/></Guard></Route>
    <Route path="/capture"><Guard><CapturePage/></Guard></Route>
    <Route path="/inbox"><Guard><InboxPage/></Guard></Route>
    <Route path="/orders"><Guard><OrdersPage/></Guard></Route>
    <Route path="/orders/:id">{params => <Guard><OrderDetailPage id={params.id}/></Guard>}</Route>
    <Route path="/customers"><Guard><CustomersPage/></Guard></Route>
    <Route path="/customers/:id">{params => <Guard><CustomerDetailPage id={params.id}/></Guard>}</Route>
    <Route path="/products"><Guard><ProductsPage/></Guard></Route>
    <Route path="/delivery"><Guard><DeliveryPage/></Guard></Route>
    <Route path="/payments"><Guard><PaymentsPage/></Guard></Route>
    <Route path="/settings"><Guard><SettingsPage/></Guard></Route>
    <Route component={NotFound}/>
  </Switch>;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to get back to your shop' } }, signUp: { start: { title: 'Create your TenhFlow account', subtitle: 'Your next order can be easier' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><TooltipProvider><CacheInvalidator/><AppRoutes/><Toaster/></TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkApp/></WouterRouter>;
}
export default App;
