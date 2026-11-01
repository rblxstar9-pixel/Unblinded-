import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, configured } from './supabase';
import {
  Feather, MessageCircle, Search, LogOut, Send, Flag, Menu
} from 'lucide-react';
import WriteArticle from './WriteArticle';
import Messages from './Messages';
import './style.css';

const categories = [
  'সব লেখা', 'ধর্ম ও বিশ্বাস', 'দর্শন', 'যুক্তিবিদ্যা',
  'নৈতিকতা ও সমাজ', 'বিজ্ঞান ও চিন্তা', 'অন্যান্য'
];

const dateFmt = s => new Date(s).toLocaleDateString('bn-BD', {
  year: 'numeric', month: 'short', day: 'numeric'
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error.message || String(error) };
  }
  componentDidCatch(error) {
    console.error('UNBLINDED ERROR:', error);
  }
  render() {
    if (this.state.error) {
      return <div style={{
        background: '#10100f', color: '#ff7777', padding: 30,
        minHeight: '100vh', overflowWrap: 'anywhere'
      }}>
        <h1>UNBLINDED ERROR</h1><pre>{this.state.error}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [articles, setArticles] = useState([]);
  const [comments, setComments] = useState([]);
  const [chat, setChat] = useState([]);
  const [category, setCategory] = useState('সব লেখা');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState('home');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [auth, setAuth] = useState({ email: '', password: '', name: '' });
  const [comment, setComment] = useState('');
  const [chatText, setChatText] = useState('');
  const [pending, setPending] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [reports, setReports] = useState([]);
  const [replyTo, setReplyTo] = useState(null);

  const say = message => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3500);
  };

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => setSession(currentSession)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadProfile();
    else {
      setProfile(null);
      setAdmin(false);
    }
  }, [session]);

  useEffect(() => { loadArticles(); }, [category, query]);

  useEffect(() => {
    if (!configured) return;
    const channel = supabase.channel('public-chat')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages'
      }, () => loadChat())
      .subscribe();
    loadChat();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (selected) loadComments(selected.id);
  }, [selected]);

  useEffect(() => {
    if (page === 'admin') loadPending();
    if (page === 'profile') loadMine();
  }, [page, admin, session]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*')
      .eq('id', session.user.id).maybeSingle();
    setProfile(data);
    setAdmin(data?.role === 'admin' || data?.role === 'moderator');
  }

  async function loadArticles() {
    if (!configured) { setArticles([]); return; }
    let request = supabase.from('articles')
      .select('id,title,slug,excerpt,body,category,created_at,author_id,profiles(display_name,avatar_url)')
      .eq('status', 'published')
      .order('created_at', { ascending: false }).limit(80);
    if (category !== 'সব লেখা') request = request.eq('category', category);
    if (query.trim()) {
      request = request.textSearch('search_vector', query.trim(), {
        type: 'websearch', config: 'simple'
      });
    }
    const { data, error } = await request;
    if (!error) setArticles(data || []);
  }

  async function loadComments(id) {
    const { data } = await supabase.from('comments')
      .select('id,body,created_at,parent_id,profiles(display_name,avatar_url)')
      .eq('article_id', id).eq('status', 'visible')
      .order('created_at');
    setComments(data || []);
  }

  async function loadChat() {
    if (!configured) return;
    const { data } = await supabase.from('chat_messages')
      .select('id,body,created_at,profiles(display_name)')
      .eq('status', 'visible').order('created_at', { ascending: true })
      .limit(100);
    setChat(data || []);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    let result;
    if (authMode === 'signup') {
      result = await supabase.auth.signUp({
        email: auth.email, password: auth.password,
        options: { data: { display_name: auth.name } }
      });
      if (!result.error && result.data.user) {
        const { error } = await supabase.from('profiles').upsert({
          id: result.data.user.id, display_name: auth.name
        });
        if (error) console.error('Profile creation:', error);
      }
    } else {
      result = await supabase.auth.signInWithPassword({
        email: auth.email, password: auth.password
      });
    }
    setBusy(false);
    say(result.error?.message || (
      authMode === 'signup'
        ? 'অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাই করুন।'
        : 'স্বাগতম!'
    ));
    if (!result.error) setPage('home');
  }

  async function sendComment(event) {
    event.preventDefault();
    if (!session) return say('মন্তব্য করতে লগইন করুন।');
    if (!comment.trim()) return;
    const { error } = await supabase.from('comments').insert({
      article_id: selected.id, author_id: session.user.id,
      body: comment.trim(), parent_id: replyTo
    });
    if (error) say(error.message);
    else {
      setComment('');
      setReplyTo(null);
      loadComments(selected.id);
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    if (!session) return say('চ্যাটে যোগ দিতে লগইন করুন।');
    if (!chatText.trim()) return;
    const { error } = await supabase.from('chat_messages').insert({
      author_id: session.user.id, body: chatText.trim()
    });
    if (error) say(error.message);
    else { setChatText(''); loadChat(); }
  }

  async function sendReport(targetType, targetId) {
    if (!session) return say('রিপোর্ট করতে লগইন করুন।');
    const reason = prompt('রিপোর্টের কারণ লিখুন (যেমন: হয়রানি, বিদ্বেষ, স্প্যাম):');
    if (!reason) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id, target_type: targetType,
      target_id: targetId, reason
    });
    say(error ? 'রিপোর্ট পাঠানো যায়নি।' : 'রিপোর্ট মডারেশন টিমের কাছে পাঠানো হয়েছে।');
  }

  async function loadPending() {
    if (!admin || !configured) return;
    const [articlesResult, reportsResult] = await Promise.all([
      supabase.from('articles').select('*,profiles(display_name)')
        .eq('status', 'pending').order('created_at'),
      supabase.from('reports').select('*')
        .eq('status', 'open').order('created_at')
    ]);
    setPending(articlesResult.data || []);
    setReports(reportsResult.data || []);
  }

  async function moderate(id, status) {
    const { error } = await supabase.from('articles')
      .update({ status }).eq('id', id);
    say(error?.message || 'পরিবর্তন সংরক্ষিত।');
    loadPending();
  }

  async function resolveReport(id, status) {
    const { error } = await supabase.from('reports')
      .update({ status }).eq('id', id);
    say(error?.message || 'রিপোর্ট আপডেট হয়েছে।');
    loadPending();
  }

  async function loadMine() {
    if (!session) return;
    const { data } = await supabase.from('articles').select('*')
      .eq('author_id', session.user.id)
      .order('created_at', { ascending: false });
    setMyArticles(data || []);
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || !session) return;
    const extension = file.name.split('.').pop();
    const path = `${session.user.id}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('avatars')
      .upload(path, file, { upsert: true });
    if (error) return say(error.message);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const result = await supabase.from('profiles').upsert({
      id: session.user.id, avatar_url: data.publicUrl
    });
    if (result.error) say(result.error.message);
    else loadProfile();
  }

  const initials = (value = 'U') => value.slice(0, 1).toUpperCase();

  const Header = () => (
    <header className="nav">
      <a className="brand" onClick={() => {
        setPage('home'); setSelected(null); setMenu(false);
      }}>
        un<span>blinded</span>.
      </a>
      <button className="mobile" onClick={() => setMenu(!menu)}><Menu /></button>
      <nav className={menu ? 'open' : ''}>
        <a onClick={() => {
          setPage('home'); setSelected(null); setMenu(false);
        }}>প্রবন্ধ</a>
        <a onClick={() => { setPage('chat'); setMenu(false); }}>
          কমিউনিটি চ্যাট
        </a>
        <a onClick={() => { setPage('messages'); setMenu(false); }}>
          <MessageCircle size={14} /> ব্যক্তিগত বার্তা
        </a>
        <a onClick={() => { setPage('write'); setMenu(false); }}>
          <Feather size={14} /> লিখুন
        </a>
        {admin && <a onClick={() => { setPage('admin'); setMenu(false); }}>
          মডারেশন
        </a>}
      </nav>
      <div className="navright">
        {session ? <>
          <button className="subtle" onClick={() => setPage('profile')}>
            {profile?.display_name || 'প্রোফাইল'}
          </button>
          <button className="iconbtn" title="লগআউট"
            onClick={() => supabase.auth.signOut()}>
            <LogOut size={17} />
          </button>
        </> : <button className="goldbtn" onClick={() => setPage('auth')}>
          প্রবেশ / নিবন্ধন
        </button>}
      </div>
    </header>
  );

  if (!configured) {
    return <div className="setup">
      <div className="brand">un<span>blinded</span>.</div>
      <div className="setupcard">
        <div className="eyebrow">প্রকাশের জন্য প্রস্তুত করুন</div>
        <h1>আপনার কমিউনিটি, আপনার নিয়ন্ত্রণে।</h1>
        <p>
          এই অ্যাপটি Supabase backend-এর সঙ্গে সংযুক্ত হওয়ার জন্য তৈরি।
          লাইভ নিবন্ধন, লেখা, মন্তব্য, চ্যাট ও মডারেশন চালু করতে Supabase
          schema সেটআপ করুন এবং hosting build environment-এ URL ও anon key দিন।
        </p>
        <ol>
          <li>Supabase-এ project তৈরি করুন।</li>
          <li>প্রয়োজনীয় schema SQL Editor-এ চালান।</li>
          <li>Project URL ও anon/publishable key build environment-এ দিন।</li>
          <li>GitHub-এ commit করে Cloudflare deployment চালু করুন।</li>
        </ol>
        <p className="muted">সেটআপ শেষ হলে পূর্ণ কমিউনিটি অ্যাপ চালু হবে।</p>
      </div>
    </div>;
  }

  return (
    <div className="app">
      <div className="topline">
        বাংলাদেশের জন্য মুক্ত, শ্রদ্ধাশীল ও যুক্তিনির্ভর আলোচনার মঞ্চ
      </div>
      <div className="container">
        <Header />

        {page === 'auth' && <section className="narrow panel">
          <div className="eyebrow">কমিউনিটিতে যোগ দিন</div>
          <h1>{authMode === 'login' ? 'আবার স্বাগতম' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}</h1>
          <form onSubmit={submitAuth}>
            {authMode === 'signup' && <input required className="field"
              placeholder="আপনার নাম / ছদ্মনাম" value={auth.name}
              onChange={e => setAuth({ ...auth, name: e.target.value })} />}
            <input required type="email" className="field" placeholder="ইমেইল"
              value={auth.email}
              onChange={e => setAuth({ ...auth, email: e.target.value })} />
            <input required minLength="8" type="password" className="field"
              placeholder="পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)" value={auth.password}
              onChange={e => setAuth({ ...auth, password: e.target.value })} />
            <button className="goldbtn full" disabled={busy}>
              {busy ? 'অপেক্ষা করুন…' : authMode === 'login' ? 'লগইন' : 'নিবন্ধন করুন'}
            </button>
          </form>
          <p>
            {authMode === 'login' ? 'নতুন এখানে?' : 'আগে থেকেই অ্যাকাউন্ট আছে?'}{' '}
            <a className="goldlink" onClick={() =>
              setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
              {authMode === 'login' ? 'নিবন্ধন করুন' : 'লগইন করুন'}
            </a>
          </p>
        </section>}

        {page === 'home' && <>
          <section className="hero">
            <div>
              <div className="eyebrow">ভাবনার স্বাধীন মঞ্চ</div>
              <h1>প্রশ্ন করুন.<br /><em>ভাবুন.</em> বুঝতে শিখুন।</h1>
              <p>
                ধর্ম, দর্শন, নৈতিকতা ও মানবজীবনের নানা প্রশ্ন নিয়ে
                যুক্তিনির্ভর লেখা, মুক্ত আলোচনা এবং পারস্পরিক শ্রদ্ধার কমিউনিটি।
              </p>
              <div className="actions">
                <button className="goldbtn" onClick={() => setPage('write')}>
                  নিজের লেখা জমা দিন <Feather size={15} />
                </button>
                <button className="outlinebtn" onClick={() => setPage('chat')}>
                  কমিউনিটিতে যোগ দিন
                </button>
              </div>
            </div>
            <div className="heroart">
              <span>আ</span><small>জিজ্ঞাসাই যাত্রার শুরু · UNBLINDED</small>
            </div>
          </section>
          <div className="principle">মত আলাদা হতে পারে — মর্যাদা ও মানবিকতা সবার জন্য</div>
          <section className="section">
            <div className="sectionhead">
              <div><div className="eyebrow">জ্ঞান ও অনুসন্ধান</div>
                <h2>ভাবনার জানালা খুলুন</h2></div>
              <p>একটি প্রশ্নের একাধিক দৃষ্টিভঙ্গি থাকতে পারে।</p>
            </div>
            <div className="toolbar">
              <div className="search"><Search size={17} />
                <input placeholder="বাংলা লেখা খুঁজুন…" value={query}
                  onChange={e => setQuery(e.target.value)} />
              </div>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="articles">
              {articles.map(article => <article className="article" key={article.id}
                onClick={() => { setSelected(article); setPage('article'); }}>
                <div className="eyebrow">
                  {article.category} · {dateFmt(article.created_at)}
                </div>
                <h3>{article.title}</h3>
                <p>{article.excerpt || article.body?.slice(0, 180)}</p>
                <div className="byline">
                  {article.profiles?.display_name || 'অজ্ঞাত লেখক'}
                  <span>প্রবন্ধ পড়ুন ↗</span>
                </div>
              </article>)}
            </div>
            {!articles.length && <div className="empty">
              এখনো প্রকাশিত লেখা নেই। প্রথম লেখা জমা দিন,
              সম্পাদকীয় পর্যালোচনার পর তা এখানে দেখা যাবে।
            </div>}
          </section>
          <section className="joinband">
            <h2>ভিন্নমত থাকুক, অসম্মান নয়।</h2>
            <p>শ্রদ্ধা, যুক্তি ও কৌতূহল—এই তিনে গড়ে উঠুক আমাদের কমিউনিটি।</p>
            <button className="darkbtn" onClick={() => setPage('write')}>লেখা শুরু করুন</button>
          </section>
        </>}

        {page === 'write' && <WriteArticle
          supabase={supabase} onClose={() => setPage('home')} />}

        {page === 'messages' && <Messages
          supabase={supabase} onClose={() => setPage('home')} />}

        {page === 'article' && selected && <section className="reading">
          <button className="back" onClick={() => {
            setPage('home'); setSelected(null);
          }}>← সব লেখা</button>
          <div className="eyebrow">
            {selected.category} · {dateFmt(selected.created_at)}
          </div>
          <h1>{selected.title}</h1>
          <p className="muted">লেখক: {selected.profiles?.display_name || 'অজ্ঞাত লেখক'}</p>
          <div className="articlebody"
            dangerouslySetInnerHTML={{ __html: selected.body || '' }} />
          <button className="report" onClick={() => sendReport('article', selected.id)}>
            <Flag size={14} /> প্রতিবেদন করুন
          </button>
          <div className="comments">
            <h2>মন্তব্য ও আলোচনা</h2>
            {comments.filter(item => !item.parent_id).map(item => <div className="comment" key={item.id}>
              <b>{item.profiles?.display_name || 'পাঠক'}</b>
              <p>{item.body}</p><small>{dateFmt(item.created_at)}</small>
              <button className="report" onClick={() => setReplyTo(item.id)}>উত্তর দিন</button>
              <button className="report" onClick={() => sendReport('comment', item.id)}>রিপোর্ট</button>
              {comments.filter(reply => reply.parent_id === item.id).map(reply =>
                <div className="reply" key={reply.id}>
                  <b>{reply.profiles?.display_name || 'পাঠক'}</b>
                  <p>{reply.body}</p><small>{dateFmt(reply.created_at)}</small>
                  <button className="report" onClick={() => sendReport('comment', reply.id)}>রিপোর্ট</button>
                </div>)}
            </div>)}
            <form onSubmit={sendComment}>
              {replyTo && <p className="hint">আপনি একটি মন্তব্যের উত্তর দিচ্ছেন।
                <button type="button" className="report" onClick={() => setReplyTo(null)}>বাতিল</button>
              </p>}
              <textarea className="field" placeholder="আপনার মন্তব্য লিখুন…"
                value={comment} onChange={e => setComment(e.target.value)} />
              <button className="goldbtn">মন্তব্য প্রকাশ করুন</button>
            </form>
          </div>
        </section>}

        {page === 'chat' && <section className="narrow panel">
          <div className="eyebrow">সবার সঙ্গে কথা বলুন</div>
          <h1>কমিউনিটি চ্যাট</h1>
          <p className="muted">মতভেদ হোক যুক্তিতে, কথোপকথনে থাকুক শ্রদ্ধা।</p>
          <div className="chatbox">
            {chat.map(message => <div className="chatmsg" key={message.id}>
              <b>{message.profiles?.display_name || 'সদস্য'}</b>
              <p>{message.body}</p><small>{dateFmt(message.created_at)}</small>
            </div>)}
          </div>
          <form onSubmit={sendChat} className="chatform">
            <input className="field" placeholder="বার্তা লিখুন…" value={chatText}
              onChange={e => setChatText(e.target.value)} maxLength="1000" />
            <button className="goldbtn"><Send size={15} /> পাঠান</button>
          </form>
          <p className="hint">
            চ্যাটে হয়রানি, হুমকি, বিদ্বেষ, ব্যক্তিগত তথ্য প্রকাশ বা স্প্যাম নিষিদ্ধ।
          </p>
        </section>}

        {page === 'profile' && session && <section className="narrow panel">
          <div className="eyebrow">আপনার পরিচয়</div><h1>লেখক প্রোফাইল</h1>
          <div className="profilebox">
            {profile?.avatar_url
              ? <img className="avatar" src={profile.avatar_url} alt="Profile" />
              : <div className="avatar placeholder">{initials(profile?.display_name)}</div>}
            <div>
              <b>{profile?.display_name || 'সদস্য'}</b>
              <p className="muted">{session.user.email}</p>
              <label className="goldlink upload">প্রোফাইল ছবি পরিবর্তন
                <input type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={uploadAvatar} />
              </label>
            </div>
          </div>
          <h2>আপনার লেখা</h2>
          {myArticles.map(article => <div className="moderow" key={article.id}>
            <b>{article.title}</b>
            <span>{article.status === 'pending' ? 'পর্যালোচনাধীন'
              : article.status === 'published' ? 'প্রকাশিত' : 'প্রত্যাখ্যাত'}</span>
          </div>)}
        </section>}

        {page === 'admin' && admin && <section className="section">
          <div className="eyebrow">সম্পাদকীয় নিয়ন্ত্রণ</div><h1>মডারেশন ড্যাশবোর্ড</h1>
          <p className="muted">শুধু অনুমোদিত মডারেটর ও অ্যাডমিনরা এই অংশ ব্যবহার করতে পারবেন।</p>
          {pending.map(article => <div className="moderow" key={article.id}>
            <div><b>{article.title}</b>
              <p>{article.profiles?.display_name} · {article.category}</p>
              <p>{article.body?.slice(0, 220)}</p></div>
            <div className="modactions">
              <button className="goldbtn" onClick={() => moderate(article.id, 'published')}>অনুমোদন</button>
              <button className="outlinebtn" onClick={() => moderate(article.id, 'rejected')}>প্রত্যাখ্যান</button>
            </div>
          </div>)}
          {!pending.length && <div className="empty">পর্যালোচনার জন্য কোনো লেখা নেই।</div>}
          <h2 style={{ marginTop: 40 }}>পাঠকের রিপোর্ট</h2>
          {reports.map(report => <div className="moderow" key={report.id}>
            <div><b>{report.target_type} · {report.reason}</b>
              <p>{dateFmt(report.created_at)} · রিপোর্ট #{report.id.slice(0, 8)}</p></div>
            <div className="modactions">
              <button className="goldbtn" onClick={() => resolveReport(report.id, 'resolved')}>সমাধান</button>
              <button className="outlinebtn" onClick={() => resolveReport(report.id, 'dismissed')}>বাতিল</button>
            </div>
          </div>)}
          {!reports.length && <div className="empty">নতুন কোনো রিপোর্ট নেই।</div>}
        </section>}

        <footer>
          <a className="brand">un<span>blinded</span>.</a>
          <span>শ্রদ্ধা · যুক্তি · সহাবস্থান</span>
          <span>© ২০২৬ আনব্লাইন্ডেড</span>
        </footer>
      </div>
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

const rootElement = document.getElementById('root');

function showRuntimeError(error) {
  if (!rootElement) return;
  rootElement.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText =
    'background:#10100f;color:#ff7777;padding:30px;min-height:100vh;font:16px sans-serif;overflow-wrap:anywhere';
  const heading = document.createElement('h1');
  heading.textContent = 'UNBLINDED RUNTIME ERROR';
  const details = document.createElement('pre');
  details.style.whiteSpace = 'pre-wrap';
  details.textContent = error?.stack || error?.message || String(error);
  box.append(heading, details);
  rootElement.appendChild(box);
}

window.addEventListener('error', event => {
  showRuntimeError(event.error || event.message);
});
window.addEventListener('unhandledrejection', event => {
  showRuntimeError(event.reason);
});

createRoot(rootElement).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
