import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "@firebase/auth";
import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sprout, LayoutDashboard, Store, TrendingUp, Landmark, MoreHorizontal,
  Search, Bell, MapPin, ChevronDown, ArrowUpRight, ArrowRight, Plus,
  Filter, Heart, MessageCircle, CheckCircle2, Clock3, ShieldCheck,
  Tractor, Leaf, FileText, Wallet, ChartNoAxesCombined, Handshake,
  Camera, Menu, X, Languages, ChevronRight, MapPinned, Package,
  ClipboardCheck, CircleHelp, Send, CalendarDays, SlidersHorizontal,
  BadgeCheck, ExternalLink, Check, Upload, Image as ImageIcon, UserRound, LoaderCircle, ShoppingCart,
  Scale, Banknote, Sprout as CropIcon
} from "lucide-react";
import { listings, prices, mandiPriceSamples, priceHistory, schemes, type Page } from "./data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CropHealthPage from "./CropHealthPage";
import LandingPage from "./LandingPage";
import AccountPage from "./AccountPage";
import QuestionnairePage from "./QuestionnairePage";
import BidList from "./BidList";
import "./direct-market.css";
import { fetchAccountProfile, getApiBaseUrl, saveAccountProfile, saveQuestionnaire, type AccountProfile, type AccountRole, type QuestionnaireAnswers } from "./auth-api";
import { firebaseAuth, signOutGoogle } from "./firebase";
import "./integration.css";

const nav: { label: Page; icon: any; group?: string }[] = [
  { label: "Home", icon: LayoutDashboard },
  { label: "Marketplace", icon: Store },
  { label: "Prices", icon: TrendingUp },
  { label: "Schemes", icon: Landmark },
  { label: "My Farm", icon: Sprout },
  { label: "Ask KisanSetu", icon: MessageCircle },
  { label: "Crop Health", icon: Leaf },
  { label: "Legal Aid", icon: Scale },
  { label: "Settings", icon: MoreHorizontal }
];

function money(n: number) { return "₹" + n.toLocaleString("en-IN"); }

type MandiOption = { id: number; name: string; district: string; state: string };
type MarketPriceRecord = {
  id: number;
  date: string;
  commodity: string;
  variety: string | null;
  mandi_id: number;
  mandi: string;
  min_price: number | string | null;
  max_price: number | string | null;
  modal_price: number | string | null;
  arrivals_qtl: number | string | null;
};

function normalizeMandiName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+mandi$/, "");
}

function isMandiOption(value: unknown): value is MandiOption {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "name" in value && typeof value.name === "string"
    && "district" in value && typeof value.district === "string"
    && "state" in value && typeof value.state === "string";
}

function isMarketPriceRecord(value: unknown): value is MarketPriceRecord {
  const isPrice = (price: unknown) =>
    price === null || typeof price === "number" || typeof price === "string";
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "date" in value && typeof value.date === "string"
    && "commodity" in value && typeof value.commodity === "string"
    && "variety" in value && (typeof value.variety === "string" || value.variety === null)
    && "mandi_id" in value && typeof value.mandi_id === "number"
    && "mandi" in value && typeof value.mandi === "string"
    && "min_price" in value && isPrice(value.min_price)
    && "max_price" in value && isPrice(value.max_price)
    && "modal_price" in value && isPrice(value.modal_price)
    && "arrivals_qtl" in value && isPrice(value.arrivals_qtl);
}

export default function App() {
  const [page, setPage] = useState<Page>("Home");
  const [screen, setScreen] = useState<"landing" | "account" | "questionnaire" | "dashboard">("landing");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [authChecking, setAuthChecking] = useState(Boolean(firebaseAuth));
  const [profileChecking, setProfileChecking] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [requestedPage, setRequestedPage] = useState<Page>("Home");
  const authRequestId = useRef(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [language, setLanguage] = useState<"EN" | "हिं">("EN");
  const [role, setRole] = useState<"farmer" | "buyer">("farmer");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [cropFilter, setCropFilter] = useState("All crops");
  const [showListingForm, setShowListingForm] = useState(false);
  const [selectedListing, setSelectedListing] = useState<number | null>(null);
  const [offerListing, setOfferListing] = useState<number | null>(null);
  const [listingCrop, setListingCrop] = useState("Tomatoes");
  const [listingQty, setListingQty] = useState("40");
  const [listingPrice, setListingPrice] = useState("1850");
  const [listingDate, setListingDate] = useState("2026-10-19");
  const [myListings, setMyListings] = useState<typeof listings>([]);
  const [bidAmount, setBidAmount] = useState("1950");
  const [activeScheme, setActiveScheme] = useState<number | null>(null);
  const [profileStep, setProfileStep] = useState(1);
  const [profile, setProfile] = useState({ state: "", district: "", land: "", ownership: "", crops: [] as string[], age: "Prefer not to say" });
  const [schemeResults, setSchemeResults] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{from: string; text: string}[]>([
    { from: "assistant", text: "Namaste! I can help you compare market offers, understand scheme eligibility, or plan your next farm decision. What would you like to explore?" }
  ]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState("");
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [legalType, setLegalType] = useState("Unpaid crop sale");
  const [legalDistrict, setLegalDistrict] = useState("Meerut");
  const [legalDone, setLegalDone] = useState(false);
  const [ledgerTab, setLedgerTab] = useState("Overview");

  const filteredListings = useMemo(() => [...myListings, ...listings].filter(x => {
    const matchesSearch = `${x.crop} ${x.location} ${x.seller}`.toLowerCase().includes(search.toLowerCase());
    const matchesCrop = cropFilter === "All crops" || x.crop === cropFilter;
    return matchesSearch && matchesCrop;
  }), [search, cropFilter, myListings]);

  useEffect(() => {
    if (!firebaseAuth) return;

    return onAuthStateChanged(firebaseAuth, user => {
      const requestId = ++authRequestId.current;
      setCurrentUser(user);
      setAuthChecking(false);
      setAccountProfile(null);
      setAccountError(null);
      setProfileChecking(Boolean(user));
      setChatMessages([
        { from: "assistant", text: "Namaste! I can help you compare market offers, understand schemes, or plan a farm decision. What would you like to explore?" }
      ]);
      setChatError(null);
      setThreadId(crypto.randomUUID());

      if (!user) {
        setProfileChecking(false);
        setRole("farmer");
        setScreen("landing");
        setPage("Home");
        return;
      }

      void fetchAccountProfile(user)
        .then(profile => {
          if (authRequestId.current !== requestId) return;
          setAccountProfile(profile);
          if (profile) {
            setRole(profile.role);
            setProfile(current => ({
              ...current,
              state: profile.state || "",
              district: profile.district_name || "",
              land: profile.farm_size_acres == null ? "" : String(profile.farm_size_acres),
              ownership: profile.land_ownership || "",
              crops: profile.crops || [],
            }));
          }
        })
        .catch(error => {
          if (authRequestId.current !== requestId) return;
          setAccountError(
            error instanceof Error
              ? error.message
              : "Could not check your KisanSetu account.",
          );
        })
        .finally(() => {
          if (authRequestId.current === requestId) setProfileChecking(false);
        });
    });
  }, []);

  useEffect(() => {
    if (screen === "account" && currentUser && accountProfile && !profileChecking) {
      setRole(accountProfile.role);
      setPage(requestedPage);
      setScreen(accountProfile.questionnaire_completed ? "dashboard" : "questionnaire");
    }
  }, [screen, currentUser, accountProfile, profileChecking, requestedPage]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }
  function go(next: Page) {
    if (!currentUser || !accountProfile) {
      setRequestedPage(next);
      setScreen("account");
      setMobileMenu(false);
      return;
    }
    setPage(next);
    setMobileMenu(false);
    setShowMore(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function enterDashboard(next: Page = "Home") {
    go(next);
  }
  function openAccount() {
    setRequestedPage("Home");
    setScreen("account");
  }
  async function handleSignOut() {
    await signOutGoogle();
    setAccountProfile(null);
    setScreen("landing");
  }
  async function chooseAccountRole(nextRole: AccountRole) {
    if (!currentUser || savingRole) return;
    setSavingRole(true);
    setAccountError(null);
    try {
      const savedProfile = await saveAccountProfile(currentUser, nextRole);
      setAccountProfile(savedProfile);
      setRole(savedProfile.role);
      setScreen(savedProfile.questionnaire_completed ? "dashboard" : "questionnaire");
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Could not save your account role.",
      );
    } finally {
      setSavingRole(false);
    }
  }
  async function updateAccountRole(nextRole: AccountRole) {
    if (!currentUser || savingRole) return;
    setSavingRole(true);
    setAccountError(null);
    try {
      const updated = await saveAccountProfile(currentUser, nextRole);
      setAccountProfile(updated);
      setRole(updated.role);
      notify("Account role updated.");
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Could not update your account role.",
      );
      notify("Account role could not be updated.");
    } finally {
      setSavingRole(false);
    }
  }
  async function retryAccountCheck() {
    if (!currentUser || profileChecking) return;
    setProfileChecking(true);
    setAccountError(null);
    try {
      const profile = await fetchAccountProfile(currentUser);
      setAccountProfile(profile);
      if (profile) {
        setRole(profile.role);
        setProfile(current => ({
          ...current,
          state: profile.state || "",
          district: profile.district_name || "",
          land: profile.farm_size_acres == null ? "" : String(profile.farm_size_acres),
          ownership: profile.land_ownership || "",
          crops: profile.crops || [],
        }));
      }
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Could not check your KisanSetu account.",
      );
    } finally {
      setProfileChecking(false);
    }
  }
  async function completeQuestionnaire(answers: QuestionnaireAnswers) {
    if (!currentUser || savingRole) return;
    setSavingRole(true);
    setAccountError(null);
    try {
      const updated = await saveQuestionnaire(currentUser, answers);
      setAccountProfile(updated);
      setProfile(current => ({
        ...current,
        state: updated.state || "",
        district: updated.district_name || "",
        land: updated.farm_size_acres == null ? "" : String(updated.farm_size_acres),
        ownership: updated.land_ownership || "",
        crops: updated.crops || [],
      }));
      setPage(requestedPage);
      setScreen("dashboard");
      notify("Your profile has been saved.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSavingRole(false);
    }
  }
  async function skipQuestionnaire() {
    await completeQuestionnaire({
      display_name: "",
      phone: "",
      state: "",
      district_name: "",
      farm_size_acres: null,
      land_ownership: "",
      crops: [],
      buyer_interests: [],
      lat: null,
      lng: null,
      skipped: true,
    });
  }
  function editQuestionnaire() {
    setRequestedPage("Settings");
    setAccountError(null);
    setScreen("questionnaire");
  }
  function publishListing(e: React.FormEvent) {
    e.preventDefault();
    const newItem = {
      id: Date.now(), crop: listingCrop, hindi: listingCrop === "Tomatoes" ? "टमाटर" : listingCrop === "Potatoes" ? "आलू" : "प्याज़",
      variety: "Your new listing", quantity: Number(listingQty), price: Number(listingPrice),
      location: `${profile.district}, ${profile.state}`, distance: "Your area", date: `Available ${listingDate}`,
      image: listingCrop === "Tomatoes" ? listings[0].image : listingCrop === "Potatoes" ? listings[1].image : listings[2].image,
      seller: "Your farm", bids: 0, tag: "YOUR LISTING"
    };
    setMyListings(prev => [newItem, ...prev]);
    setShowListingForm(false);
    notify("Listing created in this demo. No live buyer notification was sent.");
  }
  function submitBid(e: React.FormEvent) {
    e.preventDefault();
    setOfferListing(null);
    notify(`Demo bid of ${money(Number(bidAmount))}/quintal submitted. No real deal was created.`);
  }
  async function submitChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    if (!currentUser || !accountProfile) {
      go("Ask KisanSetu");
      return;
    }
    const question = chatInput.trim();
    setChatMessages(prev => [...prev, { from: "user", text: question }, { from: "assistant", text: "" }]);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);
    setChatStatus("Thinking…");

    try {
      const response = await fetch(`${getApiBaseUrl()}/agent/v1/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await currentUser.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          thread_id: threadId,
          lang: language === "EN" ? "en" : "hi",
        }),
      });
      if (!response.ok) {
        let detail = `The assistant request failed (HTTP ${response.status}).`;
        try {
          const body: unknown = await response.json();
          if (
            typeof body === "object"
            && body !== null
            && "detail" in body
            && typeof body.detail === "string"
          ) detail = body.detail;
        } catch {
          // Keep the HTTP status message when the server response is not JSON.
        }
        throw new Error(detail);
      }
      if (!response.body) throw new Error("The assistant returned no response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let completed = false;
      const handleFrame = (frame: string) => {
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) return;
        const payload: unknown = JSON.parse(dataLines.join("\n"));
        if (typeof payload !== "object" || payload === null) return;
        if (eventName === "token" && "text" in payload && typeof payload.text === "string") {
          setChatStatus("");
          setChatMessages(previous => previous.map((message, index) => (
            index === previous.length - 1 && message.from === "assistant"
              ? { ...message, text: message.text + payload.text }
              : message
          )));
        } else if (
          eventName === "step"
          && "name" in payload
          && typeof payload.name === "string"
        ) {
          setChatStatus(
            payload.name === "tools" ? "Checking farm data…" : "Preparing your answer…",
          );
        } else if (eventName === "error") {
          setChatStatus("");
          const detail = "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "The assistant could not complete this request.";
          throw new Error(detail);
        } else if (eventName === "done") {
          completed = true;
          setChatStatus("");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        let boundary = pending.match(/\r?\n\r?\n/);
        while (boundary && boundary.index !== undefined) {
          const frame = pending.slice(0, boundary.index);
          pending = pending.slice(boundary.index + boundary[0].length);
          handleFrame(frame);
          boundary = pending.match(/\r?\n\r?\n/);
        }
        if (done) break;
      }
      if (pending.trim()) handleFrame(pending);
      if (!completed) throw new Error("The assistant response ended before completion.");
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "The assistant could not complete this request.",
      );
    } finally {
      setChatLoading(false);
      setChatStatus("");
    }
  }
  const isHi = language === "हिं";
  const titleFor = (label: Page) => isHi ? ({ Home: "होम", Marketplace: "बाज़ार", Prices: "भाव", Schemes: "सरकारी योजनाएँ", "My Farm": "मेरा खेत", "Ask KisanSetu": "किसानसेतु से पूछें", "Crop Health": "फसल स्वास्थ्य", "Legal Aid": "कानूनी सहायता", Settings: "और" } as any)[label] : label;

  if (screen === "landing") {
    return (
      <LandingPage
        onNavigate={enterDashboard}
        onOpenAccount={openAccount}
      />
    );
  }

  if (screen === "account") {
    return (
      <AccountPage
        user={currentUser}
        profileExists={Boolean(accountProfile)}
        isLoading={authChecking || profileChecking}
        isSavingRole={savingRole}
        error={accountError}
        onChooseRole={chooseAccountRole}
        onRetryProfile={retryAccountCheck}
        onBack={() => setScreen("landing")}
        onSignedOut={() => {
          setAccountProfile(null);
          setAccountError(null);
          setScreen("landing");
        }}
      />
    );
  }

  if (screen === "questionnaire") {
    return (
      <QuestionnairePage
        role={accountProfile?.role || role}
        profile={accountProfile}
        defaultName={currentUser?.displayName || ""}
        isSaving={savingRole}
        error={accountError}
        onSave={completeQuestionnaire}
        onSkip={skipQuestionnaire}
        onBack={() => {
          setPage(requestedPage);
          setScreen("dashboard");
        }}
      />
    );
  }

  const accountDisplayName = accountProfile?.display_name
    || currentUser?.displayName
    || currentUser?.email
    || "KisanSetu member";

  return (
    <div className="app">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand" onClick={() => go("Home")} role="button" tabIndex={0}>
          <div className="brand-mark"><Sprout size={23} /></div>
          <div><strong>KisanSetu</strong><span>BETTER MARKETS, BETTER HARVESTS</span></div>
          <button className="icon-btn close-mobile" onClick={(e) => { e.stopPropagation(); setMobileMenu(false); }} aria-label="Close menu"><X /></button>
        </div>
        <div className="workspace-label">YOUR FARM WORKSPACE</div>
        <nav className="nav-list">
          {nav.slice(0, 5).map(item => <NavItem key={item.label} item={item} active={page === item.label} onClick={() => go(item.label)} title={titleFor(item.label)} />)}
          <div className="nav-divider" />
          <div className="workspace-label">SUPPORT & TOOLS</div>
          {nav.slice(5, 8).map(item => <NavItem key={item.label} item={item} active={page === item.label} onClick={() => go(item.label)} title={titleFor(item.label)} />)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Get help with selling, schemes or your farm records.</p><button onClick={() => go("Ask KisanSetu")}>Ask KisanSetu <ArrowRight size={14}/></button></div>
          <button className={`nav-item ${page === "Settings" ? "active" : ""}`} onClick={() => go("Settings")}><MoreHorizontal size={18}/><span>{titleFor("Settings")}</span></button>
          <div className="user-mini"><div className="avatar">{accountDisplayName.slice(0, 1).toUpperCase()}</div><div className="user-copy"><strong>{accountDisplayName}</strong><span>{accountProfile?.role === "buyer" ? "Buyer account" : "Farmer account"}</span></div><button className="user-signout" onClick={() => void handleSignOut()} aria-label="Sign out">Sign out</button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu-btn" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{titleFor(page)}</strong></div>
          <div className="top-actions">
            <div className="location-pill"><MapPin size={15}/><span>{profile.district && profile.state ? `${profile.district}, ${profile.state}` : "Add your location"}</span><ChevronDown size={13}/></div>
            <button className="language-btn" onClick={() => setLanguage(language === "EN" ? "हिं" : "EN")}><Languages size={16}/>{language}</button>
            <button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => notify("No new notifications in this demo.")}><Bell size={18}/><i /></button>
            <button className="avatar top-avatar" onClick={() => go("Settings")} aria-label="Open profile">{accountDisplayName.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
              {page === "Home" && <HomePage go={go} notify={notify} role={role} setRole={setRole} userName={accountDisplayName} />}
              {page === "Marketplace" && <MarketplacePage listings={filteredListings} search={search} setSearch={setSearch} cropFilter={cropFilter} setCropFilter={setCropFilter} showListingForm={showListingForm} setShowListingForm={setShowListingForm} selectedListing={selectedListing} setSelectedListing={setSelectedListing} offerListing={offerListing} setOfferListing={setOfferListing} listingCrop={listingCrop} setListingCrop={setListingCrop} listingQty={listingQty} setListingQty={setListingQty} listingPrice={listingPrice} setListingPrice={setListingPrice} listingDate={listingDate} setListingDate={setListingDate} publishListing={publishListing} bidAmount={bidAmount} setBidAmount={setBidAmount} submitBid={submitBid} role={accountProfile?.role || role} notify={notify} />}
              {page === "Prices" && <PricesPage go={go} notify={notify} />}
              {page === "Schemes" && <SchemesPage profile={profile} setProfile={setProfile} profileStep={profileStep} setProfileStep={setProfileStep} results={schemeResults} setResults={setSchemeResults} activeScheme={activeScheme} setActiveScheme={setActiveScheme} search={schemeSearch} setSearch={setSchemeSearch} />}
              {page === "My Farm" && <FarmPage tab={ledgerTab} setTab={setLedgerTab} notify={notify} userName={accountDisplayName} profile={profile} />}
              {page === "Ask KisanSetu" && <ChatPage messages={chatMessages} input={chatInput} setInput={setChatInput} submit={submitChat} isLoading={chatLoading} status={chatStatus} error={chatError} />}
              {page === "Crop Health" && <CropHealthPage />}
              {page === "Legal Aid" && <LegalPage type={legalType} setType={setLegalType} district={legalDistrict} setDistrict={setLegalDistrict} done={legalDone} setDone={setLegalDone} />}
              {page === "Settings" && <SettingsPage language={language} setLanguage={setLanguage} role={role} setRole={(nextRole: AccountRole) => void updateAccountRole(nextRole)} profile={profile} setProfile={setProfile} notify={notify} user={currentUser} accountProfile={accountProfile} savingRole={savingRole} accountError={accountError} onSignOut={() => void handleSignOut()} onEditQuestionnaire={editQuestionnaire} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <footer className="footer"><span>© 2026 KisanSetu</span><span>Built for better farming decisions <Sprout size={13}/></span><span>Demo data is clearly labelled</span></footer>
      </main>

      <nav className="mobile-bottom">
        {(["Home", "Marketplace", "Prices", "Schemes", "Settings"] as Page[]).map(label => {
          const Icon = nav.find(n => n.label === label)?.icon || MoreHorizontal;
          return <button key={label} className={page === label ? "mobile-active" : ""} onClick={() => go(label)}><Icon size={19}/><span>{label === "Marketplace" ? "Market" : label === "Schemes" ? "Schemes" : label === "Settings" ? "More" : label}</span></button>;
        })}
      </nav>
      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><CheckCircle2 size={18}/>{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

function NavItem({ item, active, onClick, title }: { item: {label: Page; icon: any}; active: boolean; onClick: () => void; title: string }) {
  const Icon = item.icon;
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={18}/><span>{title}</span>{active && <span className="active-dot" />}</button>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
function Button({ children, onClick, variant = "primary", icon }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; icon?: React.ReactNode }) {
  return <button className={`btn btn-${variant}`} onClick={onClick}>{icon}{children}</button>;
}
function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function HomePage({ go, notify, role, setRole, userName }: { go: (p: Page) => void; notify: (s:string)=>void; role: "farmer"|"buyer"; setRole: (r:"farmer"|"buyer")=>void; userName: string }) {
  return <div className="page-stack">
    <PageHeader eyebrow="YOUR KISANSETU WORKSPACE" title={`Namaste, ${userName.split("@")[0].split(" ")[0]} 👋`} subtitle="Your farm's market, offers and support in one place." action={<div className="role-toggle"><button className={role==="farmer"?"selected":""} onClick={()=>setRole("farmer")}>Farmer view</button><button className={role==="buyer"?"selected":""} onClick={()=>setRole("buyer")}>Buyer view</button></div>} />
    <section className="market-hero">
      <div className="hero-copy"><div className="hero-kicker"><span className="pulse-dot"/> YOUR MARKET OPPORTUNITY</div><h2>{role === "farmer" ? "Your next sale could start here." : "Find produce that fits your business."}</h2><p>{role === "farmer" ? "Compare buyer offers with mandi prices, understand your net return, and choose what works for your farm." : "Browse nearby produce, compare quantities and prices, and make a competitive offer."}</p><div className="hero-actions"><Button onClick={() => go("Marketplace")} icon={<Store size={17}/>}>{role === "farmer" ? "Compare buyer offers" : "Browse produce"}</Button><Button variant="secondary" onClick={() => go("Prices")} icon={<TrendingUp size={17}/>}>Check mandi prices</Button></div><div className="hero-trust"><span><ShieldCheck size={14}/> Transparent comparisons</span><span><MapPinned size={14}/> Delhi-NCR + UP demo region</span></div></div>
      <div className="hero-visual"><div className="hero-photo" /><div className="floating-price"><span className="floating-label">AZADPUR MANDI · DEMO</span><strong>₹1,850<span>/qtl</span></strong><span className="positive"><ArrowUpRight size={14}/> 4.2% in sample data</span></div><div className="floating-note"><div className="mini-icon"><Handshake size={17}/></div><div><strong>Buyer offers, side by side</strong><span>Compare before you decide</span></div></div></div>
    </section>
    <section className="metric-grid">
      <Metric icon={<Store/>} label="Produce listings" value="128" sub="Demo marketplace" tone="green"/>
      <Metric icon={<Handshake/>} label="Buyer offers" value="24" sub="Simulated bids" tone="gold"/>
      <Metric icon={<TrendingUp/>} label="Market snapshot" value="3 crops" sub="Prices dated 18 Oct" tone="blue"/>
      <Metric icon={<Landmark/>} label="Scheme matches" value="3 to review" sub="Not approval guarantees" tone="soil"/>
    </section>
    <div className="content-grid home-grid">
      <section className="panel"><SectionTitle title="Market snapshot" detail="Sample reference prices · 18 Oct 2026" action={<button className="text-link" onClick={() => go("Prices")}>View prices <ArrowRight size={15}/></button>}/><div className="market-table">{prices.map((p) => <div className="market-row" key={p.crop}><div className={`crop-dot ${p.crop.toLowerCase()}`}>{p.crop==="Tomato"?"T":p.crop==="Potato"?"P":"O"}</div><div className="market-name"><strong>{p.crop}</strong><span>{p.mandi}</span></div><div className="market-price"><strong>{money(p.price)}</strong><span>per quintal</span></div><div className={`change ${p.change>0?"up":"down"}`}>{p.change>0?"+":""}{p.change}%</div></div>)}</div><div className="notice-line"><Clock3 size={14}/> Demo reference data only. Confirm the latest price before selling.</div></section>
      <section className="panel opportunity-panel"><SectionTitle title="A useful next step" detail="Based on your current setup"/><div className="opportunity-icon"><Landmark size={22}/></div><span className="soft-badge">PERSONALIZED SUPPORT</span><h3>Check which government schemes may fit your farm</h3><p>Review possible matches, missing information and documents using your profile.</p><Button onClick={() => go("Schemes")} icon={<ArrowRight size={16}/>}>Check schemes for me</Button><div className="mini-separator"/><div className="support-link" onClick={() => go("Crop Health")} role="button" tabIndex={0}><div className="mini-icon"><Leaf size={17}/></div><div><strong>Need to check a crop?</strong><span>Open Crop Health tools</span></div><ChevronRight size={18}/></div></section>
    </div>
    <section className="panel"><SectionTitle title="Opportunities near your area" detail="Illustrative listings from the demo marketplace" action={<button className="text-link" onClick={() => go("Marketplace")}>Explore marketplace <ArrowRight size={15}/></button>}/><div className="listing-grid">{listings.slice(0,3).map(l => <ListingCard key={l.id} item={l} onClick={() => go("Marketplace")}/>)}</div></section>
    <section className="bottom-cta"><div className="cta-symbol"><Wallet size={25}/></div><div><h3>Know what your sale is really worth.</h3><p>Compare a buyer's offer with a dated mandi reference and estimated costs.</p></div><Button onClick={() => go("Prices")}>Compare net prices <ArrowRight size={16}/></Button></section>
  </div>;
}

function Metric({ icon, label, value, sub, tone }: {icon: React.ReactNode; label:string; value:string; sub:string; tone:string}) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>;
}
function ListingCard({ item, onClick }: {item: typeof listings[number]; onClick:()=>void}) {
  return <button className="listing-card" onClick={onClick}><div className="listing-image" style={{backgroundImage:`url(${item.image})`}}><span className="listing-tag">{item.tag}</span><span className="heart-btn"><Heart size={16}/></span></div><div className="listing-body"><div className="listing-top"><h3>{item.crop}</h3><span>{item.quantity} qtl</span></div><p>{item.variety}</p><div className="listing-price">{money(item.price)} <small>/ quintal</small></div><div className="listing-meta"><span><MapPin size={13}/>{item.location}</span><span><Clock3 size={13}/>{item.date}</span></div><div className="listing-footer"><span>{item.bids} offers / bids</span><span className="arrow-circle"><ArrowUpRight size={16}/></span></div></div></button>;
}

function MarketplacePage(props: any) {
  const {
    listings: items,
    search,
    setSearch,
    cropFilter,
    setCropFilter,
    showListingForm,
    setShowListingForm,
    selectedListing,
    setSelectedListing,
    offerListing,
    setOfferListing,
    listingCrop,
    setListingCrop,
    listingQty,
    setListingQty,
    listingPrice,
    setListingPrice,
    listingDate,
    setListingDate,
    publishListing,
    role,
    notify,
  } = props;
  const isBuyer = role === "buyer";
  const [basket, setBasket] = useState<Record<number, number>>({});
  const [basketOpen, setBasketOpen] = useState(false);
  const selected = items.find((item: typeof listings[number]) => item.id === selectedListing);
  const basketItems = items.filter((item: typeof listings[number]) => (basket[item.id] || 0) > 0);
  const basketCount = Object.values(basket).reduce((total, quantity) => total + quantity, 0);
  const basketTotal = basketItems.reduce(
    (total: number, item: typeof listings[number]) => total + item.price * basket[item.id],
    0,
  );

  function addToBasket(item: typeof listings[number], quantity = 1) {
    const alreadyAdded = basket[item.id] || 0;
    const nextQuantity = Math.min(item.quantity, alreadyAdded + quantity);
    if (nextQuantity === alreadyAdded) {
      notify("That listing does not have any more sample quantity available.");
      return;
    }
    setBasket(current => ({ ...current, [item.id]: nextQuantity }));
    notify(`${item.crop} added to your sample basket.`);
  }

  function changeBasketQuantity(item: typeof listings[number], change: number) {
    setBasket(current => {
      const next = (current[item.id] || 0) + change;
      if (next <= 0) {
        const updated = { ...current };
        delete updated[item.id];
        return updated;
      }
      return { ...current, [item.id]: Math.min(item.quantity, next) };
    });
  }

  return <div className="page-stack">
    <div className="direct-market-heading">
      <div>
        <div className="direct-market-eyebrow"><Store size={14}/> KISANSETU KISAN BAZAAR</div>
        <h1>{isBuyer ? "Buy fresh, direct from farmers." : "Your harvest has a marketplace."}</h1>
        <p>{isBuyer
          ? "Browse farm-listed produce for your shop, hotel, restaurant or home. Compare quantity, location and price before you decide."
          : "See what buyers are looking for and list your cultivation when it is ready for sale."}</p>
      </div>
      {isBuyer ? (
        <button className="direct-market-basket-button" onClick={() => setBasketOpen(true)}>
          <ShoppingCart size={17}/> Basket <span>{basketCount}</span>
        </button>
      ) : (
        <button className="direct-market-list-button" onClick={() => setShowListingForm(true)}>
          <Plus size={17}/> List your harvest
        </button>
      )}
    </div>

    <div className="direct-market-intro">
      <div className="direct-market-intro-icon"><Sprout size={21}/></div>
      <div><strong>{isBuyer ? "A direct line to the farm" : "Sell on your terms"}</strong><p>{isBuyer
        ? "Farmers list their crop, available quantity and asking price. Small businesses can source produce without an extra marketplace layer."
        : "Share the crop, quantity, harvest timing and asking price so local buyers can find your produce."}</p></div>
      <span className="direct-market-sample-label">SAMPLE MARKET</span>
    </div>

    <div className="direct-market-tools">
      <div className="search-box"><Search size={17}/><input value={search} onChange={(event: React.ChangeEvent<HTMLInputElement>)=>setSearch(event.target.value)} placeholder="Search crop, farmer or location"/></div>
      <select value={cropFilter} onChange={(event: React.ChangeEvent<HTMLSelectElement>)=>setCropFilter(event.target.value)} aria-label="Filter by crop">
        <option>All crops</option><option>Tomatoes</option><option>Potatoes</option><option>Onions</option><option>Wheat</option>
      </select>
      <span className="direct-market-result-count">{items.length} farm listings</span>
    </div>

    {showListingForm && !isBuyer && <div className="modal-backdrop"><motion.form initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="modal-card" onSubmit={publishListing}><div className="modal-head"><div><span className="eyebrow">YOUR FARM LISTING</span><h2>List your harvest</h2><p>This preview stays in this browser; it is not published to buyers yet.</p></div><button type="button" className="icon-btn" onClick={()=>setShowListingForm(false)} aria-label="Close listing form"><X/></button></div><div className="form-grid"><label>Crop<select value={listingCrop} onChange={event=>setListingCrop(event.target.value)}><option>Tomatoes</option><option>Potatoes</option><option>Onions</option><option>Wheat</option></select></label><label>Available quantity (quintals)<input type="number" min="0.1" step="0.1" required value={listingQty} onChange={event=>setListingQty(event.target.value)}/></label><label>Your asking price (₹/quintal)<input type="number" min="1" required value={listingPrice} onChange={event=>setListingPrice(event.target.value)}/></label><label>Available date<input type="date" required value={listingDate} onChange={event=>setListingDate(event.target.value)}/></label></div><div className="upload-placeholder"><Upload size={20}/><strong>Optional crop photo</strong><span>Image upload and live listing publication will be connected with the marketplace backend.</span></div><div className="modal-actions"><Button variant="secondary" onClick={()=>setShowListingForm(false)}>Cancel</Button><button className="btn btn-primary" type="submit"><Plus size={16}/> Save listing preview</button></div></motion.form></div>}

    {items.length ? <div className="direct-market-grid">{items.map((item: typeof listings[number])=><article className="direct-produce-card" key={item.id}>
      <button className="direct-produce-image" onClick={()=>setSelectedListing(item.id)} aria-label={`View ${item.crop} listing from ${item.seller}`} style={{backgroundImage:`url(${item.image})`}}>
        <span className="direct-sample-tag">SAMPLE</span>
      </button>
      <div className="direct-produce-body">
        <div className="direct-produce-seller"><span className="direct-farmer-avatar">{item.seller.slice(0,1)}</span><span><strong>{item.seller}</strong><small><MapPin size={12}/>{item.location}</small></span></div>
        <div className="direct-produce-title"><h2>{item.crop}</h2><span>{item.hindi}</span></div>
        <p className="direct-produce-variety">{item.variety}</p>
        <div className="direct-produce-quantity"><span>Available</span><strong>{item.quantity} qtl</strong><span className="direct-ready"><i/> {item.date}</span></div>
        <div className="direct-produce-price"><span>Farmer’s asking price</span><strong>{money(item.price)}<small>/ quintal</small></strong></div>
        <button className={isBuyer ? "direct-card-action" : "direct-card-action farmer-action"} onClick={()=>isBuyer ? addToBasket(item) : setSelectedListing(item.id)}>
          {isBuyer ? <><ShoppingCart size={16}/> Add 1 quintal</> : <>View listing <ArrowRight size={16}/></>}
        </button>
      </div>
    </article>)}</div> : <Empty icon={<Search/>} title="No matching farm listings" detail="Try another crop or location."/>}

    <div className="direct-market-disclaimer"><ShieldCheck size={16}/><span><strong>Prototype marketplace:</strong> these are sample listings, not real farmer offers. Basket actions are previews only; no order, payment or notification is sent.</span></div>

    {selected && !isBuyer && <div className="modal-backdrop"><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="modal-card"><div className="modal-head"><div><span className="eyebrow">SAMPLE FARM LISTING</span><h2>{selected.crop} · {selected.quantity} quintals</h2><p>{selected.seller} · {selected.location}</p></div><button className="icon-btn" onClick={()=>setSelectedListing(null)} aria-label="Close listing details"><X/></button></div><p className="muted-copy">{selected.variety} · {selected.date}. This sample listing is only stored locally and is not visible to buyers.</p><Button onClick={()=>{setSelectedListing(null);setShowListingForm(true);}}>Create your own listing preview <Plus size={16}/></Button></motion.div></div>}

    {selected && isBuyer && <div className="modal-backdrop"><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="modal-card"><div className="modal-head"><div><span className="eyebrow">SAMPLE FARM LISTING</span><h2>{selected.crop} · {selected.quantity} quintals</h2><p>{selected.seller} · {selected.location}</p></div><button className="icon-btn" onClick={()=>setSelectedListing(null)} aria-label="Close listing details"><X/></button></div><div className="detail-price-row"><div><span>Farmer’s asking price</span><strong>{money(selected.price)}<small>/qtl</small></strong></div><div><span>Available quantity</span><strong>{selected.quantity}<small> qtl</small></strong></div></div><p className="muted-copy">{selected.variety}. You can add sample quantity to a basket to preview a direct purchase flow. No order or payment is made.</p><Button onClick={()=>{addToBasket(selected);setSelectedListing(null);}}><ShoppingCart size={16}/> Add 1 quintal to basket</Button></motion.div></div>}

    {basketOpen && <div className="modal-backdrop"><motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="modal-card direct-basket-modal"><div className="modal-head"><div><span className="eyebrow">KISAN BAZAAR</span><h2>Your basket</h2><p>{basketCount} quintals · sample purchase preview</p></div><button className="icon-btn" onClick={()=>setBasketOpen(false)} aria-label="Close basket"><X/></button></div>{basketItems.length ? <><div className="direct-basket-lines">{basketItems.map((item: typeof listings[number])=><div className="direct-basket-line" key={item.id}><div><strong>{item.crop}</strong><small>{item.seller} · {money(item.price)}/qtl</small></div><div className="direct-basket-quantity"><button onClick={()=>changeBasketQuantity(item,-1)} aria-label={`Remove one quintal of ${item.crop}`}>−</button><span>{basket[item.id]} qtl</span><button onClick={()=>changeBasketQuantity(item,1)} aria-label={`Add one quintal of ${item.crop}`}>+</button></div><strong>{money(item.price*basket[item.id])}</strong></div>)}</div><div className="direct-basket-total"><span>Indicative subtotal</span><strong>{money(basketTotal)}</strong></div><p className="direct-basket-disclaimer">Illustrative prices only. Delivery, stock verification and payment are not connected yet.</p><Button onClick={()=>notify("Basket preview only—no order, payment or farmer notification was sent.")}>Review purchase request</Button></> : <Empty icon={<ShoppingCart/>} title="Your basket is empty" detail="Add produce from a farm listing to preview a purchase."/>}</motion.div></div>}
  </div>;
}

function PricesPage({ go, notify }: {go:(p:Page)=>void; notify:(s:string)=>void}) {
  const [crop,setCrop] = useState("Tomato");
  const [mandi,setMandi] = useState("all");
  const [qty,setQty] = useState("40");
  const [offer,setOffer] = useState("1950");
  const [transport,setTransport] = useState("450");
  const [mandis,setMandis] = useState<MandiOption[]>([]);
  const [marketRecords,setMarketRecords] = useState<MarketPriceRecord[]>([]);
  const [loadingPrices,setLoadingPrices] = useState(true);
  const [priceError,setPriceError] = useState<string|null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadMarketData() {
      setLoadingPrices(true);
      setPriceError(null);
      try {
        const baseUrl = getApiBaseUrl();
        const [mandiResponse, priceResponse] = await Promise.all([
          fetch(`${baseUrl}/mandis`, { signal: controller.signal }),
          fetch(`${baseUrl}/prices/records?commodity=${encodeURIComponent(crop)}&days=365`, {
            signal: controller.signal,
          }),
        ]);
        if (!mandiResponse.ok || !priceResponse.ok) {
          throw new Error("Live mandi prices could not be loaded. Please try again.");
        }
        const [mandiBody, priceBody]: [unknown, unknown] = await Promise.all([
          mandiResponse.json(),
          priceResponse.json(),
        ]);
        if (
          typeof mandiBody !== "object" || mandiBody === null || !("mandis" in mandiBody)
          || !Array.isArray(mandiBody.mandis) || !mandiBody.mandis.every(isMandiOption)
          || typeof priceBody !== "object" || priceBody === null || !("prices" in priceBody)
          || !Array.isArray(priceBody.prices) || !priceBody.prices.every(isMarketPriceRecord)
        ) {
          throw new Error("The market service returned invalid price data.");
        }
        setMandis(mandiBody.mandis);
        setMarketRecords(priceBody.prices);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPriceError(
          error instanceof Error ? error.message : "Live mandi prices could not be loaded.",
        );
        setMarketRecords([]);
      } finally {
        if (!controller.signal.aborted) setLoadingPrices(false);
      }
    }
    void loadMarketData();
    return () => controller.abort();
  }, [crop]);

  const currentPrices = useMemo(() => {
    const matching = marketRecords.filter(
      record => mandi === "all" || normalizeMandiName(record.mandi) === normalizeMandiName(mandi),
    );
    const latestByMandi = new Map<number,string>();
    for (const record of matching) {
      const latestDate = latestByMandi.get(record.mandi_id);
      if (!latestDate || record.date > latestDate) latestByMandi.set(record.mandi_id,record.date);
    }
    const latestRecords = matching.filter(record => record.date === latestByMandi.get(record.mandi_id));
    if (latestRecords.length) {
      return latestRecords.map(record => ({
        key: `live-${record.id}`,
        crop: record.commodity,
        mandi: record.mandi,
        modalPrice: record.modal_price == null ? null : Number(record.modal_price),
        minPrice: record.min_price == null ? null : Number(record.min_price),
        maxPrice: record.max_price == null ? null : Number(record.max_price),
        details: [
          record.variety,
          `Observed: ${record.date}`,
          record.arrivals_qtl == null ? null : `${record.arrivals_qtl} qtl arrivals`,
        ].filter(Boolean).join(" · "),
        source: "live" as const,
      }));
    }
    return mandiPriceSamples
      .filter(item => item.crop.toLowerCase() === crop.toLowerCase())
      .filter(item => mandi === "all" || normalizeMandiName(item.mandi) === normalizeMandiName(mandi))
      .map(item => ({
        key: `demo-${item.crop}-${item.mandi}`,
        crop: item.crop,
        mandi: item.mandi,
        modalPrice: item.price,
        minPrice: null,
        maxPrice: null,
        details: "Illustrative sample only · not a current market quote",
        source: "demo" as const,
      }));
  }, [marketRecords,mandi,crop]);
  const mandiChoices = useMemo(
    () => {
      const options = [...mandis.map(item => item.name), ...mandiPriceSamples.map(item => item.mandi)];
      const seen = new Set<string>();
      return options.filter(name => {
        const normalized = normalizeMandiName(name);
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
    },
    [mandis],
  );

  const net = Number(offer) * Number(qty) - Number(transport);
  return <div className="page-stack">
    <PageHeader eyebrow="PRICE INTELLIGENCE" title="Compare mandi prices." subtitle="Browse available mandi records. When live market data is unavailable, clearly labeled sample references keep the comparison view useful without presenting them as current quotes."/>
    <div className="filter-panel"><label>Crop<select value={crop} onChange={e=>setCrop(e.target.value)}><option>Tomato</option><option>Potato</option><option>Onion</option></select></label><label>Mandi<select value={mandi} onChange={e=>setMandi(e.target.value)}><option value="all">All mandis</option>{mandiChoices.map(name=><option value={name} key={name}>{name}</option>)}</select></label><div className="filter-context"><MapPin size={15}/>{mandis.length ? `${mandis.length} mandis in the market database` : "Showing sample comparison mandis"}</div></div>
    {!loadingPrices && <div className="notice-line"><ShieldCheck size={15}/>{currentPrices.some(record=>record.source==="live") ? "Live database records are shown where available. Any sample references are labeled and are not current market quotes." : "No live records are loaded. The prices below are illustrative sample references only—not current or verified mandi rates."}</div>}
    {priceError && <div className="chat-error" role="status">{priceError} Showing labeled sample references where available.</div>}
    {loadingPrices ? <div className="panel"><LoaderCircle className="chat-spinner" size={18}/> Loading live market records…</div>
      : currentPrices.length ? <div className="price-card-grid">{currentPrices.map(record=><div className="price-card" key={record.key}><div className="price-card-head"><div className="crop-dot tomato">{record.crop[0]}</div><span className="soft-badge">{record.source==="live" ? "LIVE MARKET RECORD" : "ILLUSTRATIVE DEMO"}</span></div><span className="muted-label">{record.mandi}</span><strong className="big-price">{record.modalPrice == null ? "—" : money(record.modalPrice)}<small>/quintal{record.source==="live" ? " modal" : ""}</small></strong><span className="change">{record.minPrice == null ? "Sample reference; range unavailable" : `Min ${money(record.minPrice)} · Max ${money(record.maxPrice ?? record.minPrice)}`}</span><div className="price-card-foot">{record.details}</div></div>)}</div>
      : <div className="panel"><SectionTitle title="No reference for this crop and mandi" detail={`There is no saved ${crop.toLowerCase()} sample for ${mandi === "all" ? "the available mandis" : mandi}.`}/><p className="muted-copy">Choose All mandis or a different crop to see the available comparison references. Live prices will appear here after market records are added.</p></div>}
    <div className="content-grid price-layout"><section className="panel chart-panel"><SectionTitle title={`${crop} price trend`} detail="Illustrative chart · not a live forecast"/><div className="chart-legend"><span><i className="legend-dot observed"/>Observed sample</span><span><i className="legend-dot forecast"/>Illustrative projection</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={priceHistory} margin={{top:10,right:10,left:0,bottom:0}}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2e7d32" stopOpacity={0.18}/><stop offset="100%" stopColor="#2e7d32" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e8ede5"/><XAxis dataKey="day" tick={{fontSize:11,fill:"#728073"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:"#728073"}} axisLine={false} tickLine={false} width={54}/><Tooltip formatter={(value:any)=>value===null?"—":`₹${value}/qtl`}/><Area type="monotone" dataKey="price" stroke="#2e7d32" strokeWidth={2.5} fill="url(#priceFill)" connectNulls={false}/><Area type="monotone" dataKey="forecast" stroke="#d39a17" strokeWidth={2} strokeDasharray="5 4" fill="none" connectNulls={false}/></AreaChart></ResponsiveContainer></div><div className="notice-line"><Clock3 size={14}/> Illustrative values only. No live forecast or market API is connected.</div></section>
      <section className="panel net-panel"><SectionTitle title="Estimate your net proceeds" detail="Change assumptions to compare a buyer offer."/><div className="form-stack"><label>Buyer offer (₹/quintal)<input type="number" value={offer} onChange={e=>setOffer(e.target.value)}/></label><label>Quantity (quintals)<input type="number" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Estimated transport cost (₹ total)<input type="number" value={transport} onChange={e=>setTransport(e.target.value)}/></label></div><div className="net-result"><span>Estimated net proceeds</span><strong>{money(net)}</strong><small>Assumes all listed quantity is sold at the entered offer, less the entered transport cost.</small></div><Button onClick={()=>notify("Estimate updated locally. This is not a guaranteed sale value.")}>Save comparison <Check size={16}/></Button><button className="text-link" onClick={()=>go("Marketplace")}>Compare with marketplace offers <ArrowRight size={15}/></button></section></div>
    <div className="notice-line"><ShieldCheck size={15}/> A higher gross offer is not always better. Check quantity, transport, pickup terms and payment terms.</div>
  </div>;
}

function SchemesPage(props:any) {
  const {profile,setProfile,profileStep,setProfileStep,results,setResults,activeScheme,setActiveScheme,search,setSearch} = props;
  const filtered = schemes.filter(s=>`${s.name} ${s.category} ${s.description}`.toLowerCase().includes(search.toLowerCase()));
  function toggleCrop(crop:string){setProfile((p:any)=>({...p,crops:p.crops.includes(crop)?p.crops.filter((x:string)=>x!==crop):[...p.crops,crop]}));}
  return <div className="page-stack">
    <PageHeader eyebrow="PERSONALIZED GOVERNMENT SUPPORT" title="Find schemes that may fit your farm." subtitle="Answer a few questions to see possible matches, missing details and official next steps."/>
    <div className="schemes-intro"><div className="schemes-intro-icon"><Landmark size={25}/></div><div><h3>Benefits are personal. Eligibility is rule-based.</h3><p>Recommendations depend on your location, landholding, crops and the rules available to KisanSetu. A match is not a guarantee of approval.</p></div><div className="official-stamp"><ShieldCheck size={18}/><span>Official sources<br/>shown on each scheme</span></div></div>
    <div className="scheme-layout">
      <section className="panel scheme-wizard"><div className="wizard-head"><div><span className="eyebrow">YOUR FARM PROFILE</span><h2>Check schemes for me</h2><p>Only provide details relevant to the rules being checked.</p></div><span className="step-count">STEP {profileStep} OF 3</span></div><div className="progress-track"><span style={{width:`${profileStep/3*100}%`}}/></div>
      {profileStep===1 && <div className="form-stack"><label>State<select value={profile.state} onChange={e=>setProfile({...profile,state:e.target.value})}><option>Uttar Pradesh</option><option>Haryana</option><option>Delhi</option><option>Punjab</option><option>Rajasthan</option></select></label><label>District<input value={profile.district} onChange={e=>setProfile({...profile,district:e.target.value})} placeholder="Enter district"/></label><label>Landholding area (acres)<input type="number" min="0" step=".1" value={profile.land} onChange={e=>setProfile({...profile,land:e.target.value})}/></label><label>Land / cultivation status<select value={profile.ownership} onChange={e=>setProfile({...profile,ownership:e.target.value})}><option>Owner</option><option>Tenant</option><option>Sharecropper</option><option>Other</option></select></label><div className="form-actions"><Button onClick={()=>setProfileStep(2)}>Continue <ArrowRight size={16}/></Button></div></div>}
      {profileStep===2 && <div className="form-stack"><label>Which crops do you grow?</label><div className="crop-select-grid">{["Wheat","Potato","Tomato","Onion","Rice","Sugarcane"].map(c=><button type="button" key={c} className={`crop-choice ${profile.crops.includes(c)?"chosen":""}`} onClick={()=>toggleCrop(c)}>{profile.crops.includes(c)&&<Check size={14}/>} {c}</button>)}</div><label>Age range (only used if a scheme requires it)<select value={profile.age} onChange={e=>setProfile({...profile,age:e.target.value})}><option>Under 18</option><option>18–35</option><option>35–60</option><option>Over 60</option><option>Prefer not to say</option></select></label><div className="notice-line"><ShieldCheck size={14}/> Sensitive optional fields are not requested by default.</div><div className="form-actions split"><Button variant="secondary" onClick={()=>setProfileStep(1)}>Back</Button><Button onClick={()=>setProfileStep(3)}>Review <ArrowRight size={16}/></Button></div></div>}
      {profileStep===3 && <div className="review-box"><div className="review-line"><span>Location</span><strong>{profile.district}, {profile.state}</strong></div><div className="review-line"><span>Landholding</span><strong>{profile.land || "Not provided"} acres · {profile.ownership}</strong></div><div className="review-line"><span>Crops</span><strong>{profile.crops.join(", ") || "Not selected"}</strong></div><div className="review-line"><span>Age range</span><strong>{profile.age}</strong></div><p className="muted-copy">This prototype uses illustrative matching explanations. It does not run the official scheme eligibility rules.</p><div className="form-actions split"><Button variant="secondary" onClick={()=>setProfileStep(2)}>Back</Button><Button onClick={()=>{setResults(true);setProfileStep(3)}}>Show possible matches <ArrowRight size={16}/></Button></div></div>}
      <div className="privacy-note"><ShieldCheck size={15}/><span>Your profile should only be used for relevant matching. Connect the real eligibility engine before treating results as authoritative.</span></div></section>
      <section className="scheme-results"><div className="results-head"><div><span className="eyebrow">SCHEME EXPLORER</span><h2>{results?"Possible matches for your profile":"Browse available schemes"}</h2><p>{results?"Review the reasons, required documents and official source.":"Browse seeded examples while the rules engine is being connected."}</p></div><span className="result-count">{filtered.length} examples</span></div><div className="search-box scheme-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search schemes or support type"/></div>{filtered.map((s,i)=><div className={`scheme-card ${activeScheme===s.id?"scheme-expanded":""}`} key={s.id}><button className="scheme-card-top" onClick={()=>setActiveScheme(activeScheme===s.id?null:s.id)}><div className="scheme-logo"><Landmark size={20}/></div><div className="scheme-main"><span className="scheme-category">{s.category}</span><h3>{s.name}</h3><p>{s.description}</p></div><ChevronDown className={activeScheme===s.id?"rotate":""} size={18}/></button><div className="scheme-status-row"><span className={`status-pill ${results?"status-review":"status-neutral"}`}>{results?(i===0?"Needs verification":i===1?"Potential match":"Check season"):s.status}</span><span className="muted-label">Source needs verification</span></div>{activeScheme===s.id&&<div className="scheme-details"><div><strong>Why this may be relevant</strong><p>{s.why}</p></div><div><strong>Documents to review</strong><ul>{s.documents.map(d=><li key={d}>{d}</li>)}</ul></div><div className="source-row"><span>Official portal / scheme information</span><a href={s.source} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a></div><p className="small-warning">This is a demo explanation, not an official eligibility verdict. Confirm the current rules on the linked portal.</p></div>}</div>)}</section>
    </div>
  </div>;
}

function FarmPage({tab,setTab,notify,userName,profile}:{tab:string;setTab:(s:string)=>void;notify:(s:string)=>void;userName:string;profile:{state:string;district:string;land:string;ownership:string;crops:string[];age:string}}) {
  const [entries,setEntries] = useState([{date:"16 Oct 2026",category:"Fertiliser",note:"Wheat crop",amount:2400},{date:"12 Oct 2026",category:"Labour",note:"Field preparation",amount:1800},{date:"09 Oct 2026",category:"Seeds",note:"Potato season",amount:3200}]);
  const [show,setShow] = useState(false);
  const [amount,setAmount] = useState("1000");
  const [category,setCategory] = useState("Seeds");
  const [note,setNote] = useState("");
  function add(e:React.FormEvent){e.preventDefault();setEntries(prev=>[{date:"Today",category,note:note||"Farm expense",amount:Number(amount)},...prev]);setShow(false);notify("Expense added to local demo ledger.");}
  const totalExpenses = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const location = [profile.district, profile.state].filter(Boolean).join(", ") || "Location not provided";
  const crops = profile.crops.join(", ") || "Not provided";
  return <div className="page-stack"><PageHeader eyebrow="YOUR FARM BUSINESS" title="Your farm, clearly accounted for." subtitle="Keep an eye on expenses, sales and the records behind your decisions." action={<Button onClick={()=>setShow(true)} icon={<Plus size={16}/>}>Add entry</Button>}/><div className="metric-grid"><Metric icon={<Wallet/>} label="Recorded expenses" value={money(totalExpenses)} sub="Local demo ledger" tone="green"/><Metric icon={<Banknote/>} label="Recorded sales" value="₹24,500" sub="Illustrative sample" tone="gold"/><Metric icon={<ChartNoAxesCombined/>} label="Net estimate" value={money(24500-totalExpenses)} sub="Sales minus listed expenses" tone="blue"/><Metric icon={<Package/>} label="Main crops" value={String(profile.crops.length)} sub={crops} tone="soil"/></div><div className="panel"><div className="market-tabs"><button className={tab==="Overview"?"tab-active":""} onClick={()=>setTab("Overview")}>Overview</button><button className={tab==="Ledger"?"tab-active":""} onClick={()=>setTab("Ledger")}>Khata / ledger</button><button className={tab==="Sales"?"tab-active":""} onClick={()=>setTab("Sales")}>Sales & deals</button></div>{tab==="Overview"&&<div className="farm-overview"><div className="farm-summary"><div className="large-farm-icon"><Tractor size={26}/></div><div><h3>{userName.split("@")[0].split(" ")[0]}'s farm</h3><p>{location}{profile.land ? ` · ${profile.land} acres` : ""}</p><span className="soft-badge">{profile.land || !profile.state || !profile.district ? "PROFILE CAN BE COMPLETED IN SETTINGS" : "PROFILE DETAILS SAVED"}</span></div><Button variant="secondary" onClick={()=>notify("Open Settings to edit your profile and location details.")}>Edit profile</Button></div><div className="farm-stat-grid"><div><span>Main crops</span><strong>{crops}</strong></div><div><span>Landholding</span><strong>{profile.land ? `${profile.land} acres` : "Not provided"}</strong></div><div><span>Land arrangement</span><strong>{profile.ownership || "Not provided"}</strong></div></div></div>}{tab==="Ledger"&&<div className="ledger-table"><div className="ledger-head"><span>Date</span><span>Category / note</span><span>Amount</span></div>{entries.map((e,i)=><div className="ledger-row" key={i}><span>{e.date}</span><div><strong>{e.category}</strong><small>{e.note}</small></div><strong>{money(e.amount)}</strong></div>)}</div>}{tab==="Sales"&&<BidList />}</div>{show&&<div className="modal-backdrop"><form className="modal-card" onSubmit={add}><div className="modal-head"><div><span className="eyebrow">FARM KHATA</span><h2>Add an expense</h2></div><button type="button" className="icon-btn" onClick={()=>setShow(false)}><X/></button></div><div className="form-stack"><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>Seeds</option><option>Fertiliser</option><option>Pesticide</option><option>Labour</option><option>Water</option><option>Machinery</option><option>Other</option></select></label><label>Amount (₹)<input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>Note<input value={note} onChange={e=>setNote(e.target.value)} placeholder="What was this expense for?"/></label></div><div className="modal-actions"><Button variant="secondary" onClick={()=>setShow(false)}>Cancel</Button><button type="submit" className="btn btn-primary">Save demo entry</button></div></form></div>}</div>;
}

function ChatPage({messages,input,setInput,submit,isLoading,status,error}:{messages:{from:string;text:string}[];input:string;setInput:(s:string)=>void;submit:(e:React.FormEvent)=>void;isLoading:boolean;status:string;error:string|null}) {
  return <div className="page-stack"><PageHeader eyebrow="YOUR FARM ASSISTANT" title="Ask KisanSetu." subtitle="Get help understanding market choices, farm records and relevant support."/><div className="chat-layout"><aside className="panel chat-aside"><div className="assistant-avatar"><Sprout size={24}/></div><h3>Your farm decision assistant</h3><p>Ask about mandi prices, comparing offers, weather, or understanding a scheme. Responses come from the connected KisanSetu agent.</p><div className="chat-suggestion-list"><button onClick={()=>setInput("How do I compare a buyer offer with mandi price?")}>Compare buyer vs mandi price <ArrowRight size={14}/></button><button onClick={()=>setInput("Which documents should I check for a government scheme?")}>Scheme documents <ArrowRight size={14}/></button><button onClick={()=>setInput("How should I estimate net proceeds after transport?")}>Estimate net proceeds <ArrowRight size={14}/></button></div></aside><section className="panel chat-window"><div className="chat-head"><div className="assistant-avatar small"><Sprout size={18}/></div><div><strong>KisanSetu Assistant</strong><span><i className="online-dot"/> Connected to the farm assistant</span></div></div><div className="chat-messages">{messages.map((m,i)=><div className={`chat-message ${m.from==="user"?"message-user":""}`} key={i}><div className="message-avatar">{m.from==="user"?<UserRound size={16}/>:<Sprout size={16}/>}</div><div className="message-bubble">{m.text ? m.from === "assistant" ? <div className="assistant-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown></div> : m.text : isLoading && i===messages.length-1 ? <><LoaderCircle size={16} className="chat-spinner" aria-label="Assistant is responding"/> {status}</> : ""}</div></div>)}{error&&<div className="chat-error" role="alert">{error}</div>}</div><form className="chat-compose" onSubmit={submit}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about prices, offers or schemes…" disabled={isLoading}/><button className="send-btn" aria-label="Send message" disabled={isLoading||!input.trim()}>{isLoading?<LoaderCircle size={17} className="chat-spinner"/>:<Send size={17}/>}</button></form><p className="chat-disclaimer">Check official sources and dated prices before making financial decisions.</p></section></div></div>;
}

function LegalPage({type,setType,district,setDistrict,done,setDone}:{type:string;setType:(s:string)=>void;district:string;setDistrict:(s:string)=>void;done:boolean;setDone:(b:boolean)=>void}) {
  return <div className="page-stack"><PageHeader eyebrow="LEGAL AID NAVIGATOR" title="Understand your options and where to get help." subtitle="A guided legal-information flow for Uttar Pradesh. This is information, not legal advice."/><div className="legal-layout"><section className="panel"><div className="legal-heading"><div className="legal-icon"><Scale size={22}/></div><div><h2>Tell us what happened</h2><p>Share only the details needed to guide the next step.</p></div></div>{!done?<div className="form-stack"><label>Type of dispute<select value={type} onChange={e=>setType(e.target.value)}><option>Unpaid crop sale</option><option>Land boundary dispute</option><option>Tenancy or inheritance</option><option>Loan harassment</option><option>False land claim</option></select></label><label>District<input value={district} onChange={e=>setDistrict(e.target.value)}/></label><label>Urgency<select><option>Routine</option><option>Time-sensitive</option><option>Immediate threat or violence</option></select></label><Button onClick={()=>setDone(true)}>Prepare information checklist <ArrowRight size={16}/></Button></div>:<div className="legal-answer"><span className="soft-badge">DEMO GUIDANCE</span><h3>Suggested information to gather</h3><p>For: {type} · {district}, Uttar Pradesh</p><ul><li>Keep copies of agreements, receipts and relevant messages.</li><li>Write down dates, parties involved and what remains unresolved.</li><li>Check the relevant local office or seek advice from a qualified lawyer before filing.</li></ul><div className="notice-line">Legal information, not legal advice. Ask a lawyer to review documents before filing.</div><a className="official-link" href="https://nalsa.gov.in/" target="_blank" rel="noreferrer">National Legal Services Authority <ExternalLink size={14}/></a><Button variant="secondary" onClick={()=>setDone(false)}>Edit answers</Button></div>}</section><aside className="panel legal-emergency"><div className="legal-icon"><ShieldCheck size={22}/></div><h3>Need urgent help?</h3><p>If someone is in immediate danger, contact emergency services first.</p><div className="emergency-number">112</div><span>India emergency number</span><div className="mini-separator"/><strong>Free legal assistance depends on eligibility.</strong><p>Ask the District Legal Services Authority or visit the official NALSA site for current information.</p></aside></div></div>;
}

function SettingsPage({
  language,
  setLanguage,
  role,
  setRole,
  profile,
  setProfile,
  notify,
  user,
  accountProfile,
  savingRole,
  accountError,
  onSignOut,
  onEditQuestionnaire,
}: {
  language: "EN" | "हिं";
  setLanguage: (language: "EN" | "हिं") => void;
  role: AccountRole;
  setRole: (role: AccountRole) => void;
  profile: { state: string; district: string; land: string; ownership: string; crops: string[]; age: string };
  setProfile: (profile: { state: string; district: string; land: string; ownership: string; crops: string[]; age: string }) => void;
  notify: (message: string) => void;
  user: User | null;
  accountProfile: AccountProfile | null;
  savingRole: boolean;
  accountError: string | null;
  onSignOut: () => void;
  onEditQuestionnaire: () => void;
}) {
  const displayName = accountProfile?.display_name || user?.displayName || user?.email || "KisanSetu member";
  return (
    <div className="page-stack">
      <PageHeader eyebrow="PROFILE & PREFERENCES" title="Make KisanSetu work for you." subtitle="Manage your verified account, language and local workspace preferences." />
      <div className="settings-grid">
        <section className="panel">
          <div className="settings-profile">
            <div className="avatar settings-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
            <div><h2>{displayName}</h2><p>{user?.email || "Google account"} · Firebase authenticated</p></div>
            <span className="soft-badge">VERIFIED</span>
          </div>
          <div className="settings-form">
            <label>Preferred language<select value={language} onChange={e=>setLanguage(e.target.value as "EN" | "हिं")}><option value="EN">English</option><option value="हिं">हिन्दी (Hindi)</option></select></label>
            <label>Marketplace role<select value={role} disabled={savingRole} onChange={e=>setRole(e.target.value as AccountRole)}><option value="farmer">Farmer</option><option value="buyer">Buyer</option></select></label>
            <label>State<select value={profile.state} onChange={e=>setProfile({...profile,state:e.target.value})}><option>Uttar Pradesh</option><option>Haryana</option><option>Delhi</option><option>Punjab</option><option>Rajasthan</option></select></label>
            <label>District<input value={profile.district} onChange={e=>setProfile({...profile,district:e.target.value})}/></label>
            <label>Landholding (acres)<input type="number" value={profile.land} onChange={e=>setProfile({...profile,land:e.target.value})}/></label>
            {savingRole && <span className="muted-label">Updating account role…</span>}
            {accountError && <div className="chat-error" role="alert">{accountError}</div>}
            <Button onClick={onEditQuestionnaire}>Edit saved profile details <Check size={16}/></Button>
            <Button variant="secondary" onClick={()=>notify("Language preference applies to this browser session; profile details are saved to your account.")}>Save local preferences</Button>
            <Button variant="secondary" onClick={onSignOut}>Sign out of Google</Button>
          </div>
        </section>
        <section className="panel">
          <SectionTitle title="Privacy & trust" detail="Account and service information"/>
          <div className="privacy-list">
            <div><ShieldCheck/><span><strong>Authenticated account</strong><small>Your dashboard and assistant requests use a Firebase-verified identity.</small></span></div>
            <div><Banknote/><span><strong>Market information</strong><small>Some marketplace and price information remains illustrative; check dated official sources.</small></span></div>
            <div><UserRound/><span><strong>Saved profile details</strong><small>Your questionnaire answers are stored on your account. Exact coordinates are optional and only collected after you request location access.</small></span></div>
          </div>
          <div className="notice-line">Do not rely on illustrative marketplace figures as live quotes or financial advice.</div>
        </section>
      </div>
    </div>
  );
}

function Empty({icon,title,detail}:{icon:React.ReactNode;title:string;detail:string}) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{detail}</p></div>;
}