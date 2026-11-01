import React, { useEffect, useMemo, useState } from 'react';
import { supabase, configured } from './supabase.js';

const CATEGORIES = ['সব', 'মতামত', 'সমাজ', 'সংস্কৃতি', 'বিজ্ঞান', 'প্রযুক্তি', 'দর্শন', 'রাজনীতি'];

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap');
:root{font-family:'DM Sans','Noto Sans Bengali',sans-serif;color:#eeeae2;background:#10100f;font-synthesis:none}
*{box-sizing:border-box}body{margin:0;background:#10100f}button,input,textarea,select{font:inherit}
button{cursor:pointer}a{color:inherit;text-decoration:none}
.app{min-height:100vh;background:#10100f;color:#eeeae2}
.topbar{height:76px;border-bottom:1px solid #292825;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;position:sticky;top:0;background:#10100fef;backdrop-filter:blur(14px);z-index:10}
.logo{font-size:25px;letter-spacing:4px;font-weight:800;color:#f3eee4}.logo span{color:#d6a75d}
.nav{display:flex;align-items:center;gap:23px}.nav button,.quiet{border:0;background:none;color:#b9b5ad;font-size:13px}.nav button:hover,.quiet:hover{color:#e7b86b}
.btn{border:1px solid #d6a75d;background:#d6a75d;color:#171512;padding:11px 17px;border-radius:3px;font-weight:700;font-size:13px}
.btn:hover{background:#edc47e}.btn.secondary{background:transparent;color:#e4bd7b}.btn.dark{background:#25231f;color:#eee;border-color:#38352e}
.container{width:min(1180px,90%);margin:auto}.hero{padding:90px 0 74px;border-bottom:1px solid #292825}
.eyebrow{color:#d6a75d;text-transform:uppercase;letter-spacing:3px;font-size:11px;font-weight:700}
.hero h1{font-size:clamp(48px,8vw,100px);line-height:1.08;letter-spacing:-4px;max-width:900px;margin:23px 0}
.hero h1 em{font-style:normal;color:#d6a75d}.hero p{color:#aaa69d;line-height:1.9;max-width:590px;font-size:16px}
.hero-actions{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}
.section{padding:55px 0}.section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px;gap:15px}
.section-head h2{font-size:26px;margin:0}.muted{color:#918d84}.small{font-size:12px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}
.article-card{border:1px solid #302e29;background:#171715;padding:23px;min-height:230px;display:flex;flex-direction:column;transition:.2s}
.article-card:hover{border-color:#a9844d;transform:translateY(-3px)}
.tag{color:#d6a75d;font-size:11px;letter-spacing:1px;text-transform:uppercase}
.article-card h3{font-size:21px;line-height:1.55;margin:15px 0 10px}
.article-card p{color:#aaa69d;font-size:13px;line-height:1.8;margin:0 0 20px}
.card-foot{margin-top:auto;border-top:1px solid #302e29;padding-top:14px;display:flex;justify-content:space-between;color:#89857c;font-size:11px}
.categories{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:25px}
.chip{border:1px solid #38352e;background:transparent;color:#b9b5ad;padding:8px 13px;border-radius:30px;font-size:12px}
.chip.active{background:#d6a75d;border-color:#d6a75d;color:#171512}
.page{padding:55px 0;min-height:70vh}.panel{background:#171715;border:1px solid #302e29;padding:25px;border-radius:4px}
.form{display:grid;gap:13px;max-width:680px}.field{width:100%;background:#10100f;border:1px solid #38352e;color:#eeeae2;padding:13px 14px;border-radius:3px;outline:none}
.field:focus{border-color:#d6a75d}.field::placeholder{color:#77736c}textarea.field{min-height:150px;resize:vertical}
.article-body{white-space:pre-wrap;line-height:2.1;color:#d0ccc3;font-size:17px;max-width:780px}
.article-title{font-size:clamp(32px,5vw,58px);line-height:1.35;margin:15px 0 20px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}
.comment{border-top:1px solid #302e29;padding:17px 0}.comment p{line-height:1.8;color:#c5c0b7}
.footer{border-top:1px solid #292825;padding:35px 5vw;color:#77736c;font-size:12px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.notice{padding:13px 15px;background:#29251d;border:1px solid #5b482c;color:#e5c58c;font-size:13px;margin:15px 0}
.empty{padding:45px 20px;text-align:center;color:#89857c;border:1px dashed #38352e}
.mobile-menu{display:none}
@media(max-width:800px){.nav{gap:10px}.nav button{font-size:11px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{padding:65px 0}.hero h1{letter-spacing:-2px}}
@media(max-width:560px){.topbar{padding:0 5%;height:65px}.logo{font-size:20px}.nav{gap:8px}.nav button{display:none}.nav button:last-child{display:block}.grid{grid-template-columns:1fr}.hero h1{font-size:49px}.section{padding:38px 0}.page{padding:35px 0}}
`;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [articles, setArticles] = useState([]);
  const [authors, setAuthors] = useState({});
  const [comments, setComments] = useState([]);
  const [chat, setChat] = useState([]);
  const [page, setPage] = useState('home');
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('সব');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [draft, setDraft] = useState({ title: '', category: 'মতামত', excerpt: '', body: '' });
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [chatText, setChatText] = useState('');
  const [busy, setBusy] = useState(false);

  const isModerator = ['admin', 'editor', 'moderator'].includes(profile?.role);

  useEffect(() => {
    if (!configured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configured || !supabase) return;
    loadArticles();
    loadChat();
  }, [session]);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    loadProfile();
  }, [session]);

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    setProfile(data || null);
  }

  async function loadArticles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    setArticles(rows);

    const ids = [...new Set(rows.map(a => a.author_id).filter(Boolean))];
    if (ids.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url,bio,role')
        .in('id', ids);

      const map = {};
      (people || []).forEach(person => { map[person.id] = person; });
      setAuthors(map);
    }
    setLoading(false);
  }

  async function loadComments(articleId) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = data || [];
    setComments(rows);
    const ids = [...new Set(rows.map(c => c.author_id))];
    if (ids.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', ids);

      setAuthors(old => {
        const next = { ...old };
        (people || []).forEach(person => { next[person.id] = person; });
        return next;
      });
    }
  }

  async function loadChat() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('status', 'visible')
      .order('created_at', { ascending: true })
      .limit(100);

    const rows = data || [];
    setChat(rows);

    const ids = [...new Set(rows.map(c => c.author_id))];
    if (ids.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id,display_name')
        .in('id', ids);

      setAuthors(old => {
        const next = { ...old };
        (people || []).forEach(person => { next[person.id] = person; });
        return next;
      });
    }
  }

  async function authenticate(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    let result;
    if (authMode === 'signup') {
      result = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { display_name: displayName || 'নতুন সদস্য' } }
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      });
    }

    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else {
      setMessage(authMode === 'signup'
        ? 'অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল ভেরিফিকেশন প্রয়োজন হলে সেটি সম্পন্ন করুন।'
        : 'স্বাগতম! আপনি লগইন করেছেন।');
      if (result.data.session) setPage('home');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setPage('home');
    setSelected(null);
    setMessage('আপনি লগআউট করেছেন।');
  }

  async function publishArticle(e) {
    e.preventDefault();
    if (!session?.user) return setPage('auth');
    setBusy(true);
    const slug = `${draft.title.toLowerCase().trim().replace(/[^a-z0-9-বাংলা-হরফ]+/g, '-')}-${Date.now().toString().slice(-5)}`;

    const { error } = await supabase.from('articles').insert({
      author_id: session.user.id,
      title: draft.title,
      slug,
      category: draft.category,
      excerpt: draft.excerpt,
      body: draft.body,
      status: 'pending'
    });

    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage('আপনার লেখা সম্পাদকীয় অনুমোদনের জন্য জমা হয়েছে।');
      setDraft({ title: '', category: 'মতামত', excerpt: '', body: '' });
      setPage('home');
      loadArticles();
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!session?.user) return setPage('auth');
    if (!commentText.trim() || !selected) return;

    const { error } = await supabase.from('comments').insert({
      article_id: selected.id,
      author_id: session.user.id,
      parent_id: replyTo,
      body: commentText.trim(),
      status: 'visible'
    });

    if (error) setMessage(error.message);
    else {
      setCommentText('');
      setReplyTo(null);
      loadComments(selected.id);
    }
  }

  async function sendChat(e) {
    e.preventDefault();
    if (!session?.user) return setPage('auth');
    if (!chatText.trim()) return;

    const { error } = await supabase.from('chat_messages').insert({
      author_id: session.user.id,
      body: chatText.trim(),
      status: 'visible'
    });

    if (error) setMessage(error.message);
    else {
      setChatText('');
      loadChat();
    }
  }

  async function approveArticle(articleId) {
    const { error } = await supabase
      .from('articles')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', articleId);

    setMessage(error ? error.message : 'লেখাটি প্রকাশিত হয়েছে।');
    loadArticles();
  }

  async function hideComment(commentId) {
    const { error } = await supabase
      .from('comments')
      .update({ status: 'hidden' })
      .eq('id', commentId);

    setMessage(error ? error.message : 'কমেন্টটি হাইড করা হয়েছে।');
    if (selected) loadComments(selected.id);
  }

  async function reportArticle(articleId) {
    if (!session?.user) return setPage('auth');
    const reason = window.prompt('কেন রিপোর্ট করছেন?');
    if (!reason?.trim()) return;

    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      target_type: 'article',
      target_id: articleId,
      reason: reason.trim()
    });
    setMessage(error ? error.message : 'রিপোর্ট জমা হয়েছে।');
  }

  function openArticle(article) {
    setSelected(article);
    setPage('article');
    loadComments(article.id);
  }

  const visibleArticles = useMemo(() => {
    return articles.filter(article => {
      const categoryMatch = category === 'সব' || article.category === category;
      const searchMatch = !search || [
        article.title, article.excerpt, article.body, article.category
      ].join(' ').toLowerCase().includes(search.toLowerCase());
      return categoryMatch && searchMatch;
    });
  }, [articles, category, search]);

  const published = articles.filter(a => a.status === 'published');
  const pending = articles.filter(a => a.status === 'pending');
  const myArticles = articles.filter(a => a.author_id === session?.user?.id);

  if (!configured || !supabase) {
    return <div className="app"><style>{css}</style><div className="container page">
      <div className="logo">UN<span>BLINDED</span></div>
      <div className="notice">Supabase configuration পাওয়া যায়নি। আপনার `src/supabase.js` ফাইলে VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY সেট করুন।</div>
    </div></div>;
  }

  return (
    <div className="app">
      <style>{css}</style>

      <header className="topbar">
        <button className="quiet logo" onClick={() => { setPage('home'); setSelected(null); }}>
          UN<span>BLINDED</span>
        </button>

        <nav className="nav">
          <button onClick={() => setPage('home')}>প্রচ্ছদ</button>
          <button onClick={() => setPage('library')}>নিবন্ধ</button>
          <button onClick={() => setPage('community')}>সম্প্রদায়</button>
          {session && <button onClick={() => setPage('write')}>লিখুন</button>}
          {isModerator && <button onClick={() => setPage('editorial')}>সম্পাদকীয়</button>}
          {session
            ? <button className="btn" onClick={() => setPage('account')}>আমার অ্যাকাউন্ট</button>
            : <button className="btn" onClick={() => setPage('auth')}>প্রবেশ করুন</button>}
        </nav>
      </header>

      {message && (
        <div className="container"><div className="notice row between">
          <span>{message}</span>
          <button className="quiet" onClick={() => setMessage('')}>✕</button>
        </div></div>
      )}

      {page === 'home' && <>
        <section className="hero container">
          <div className="eyebrow">চিন্তা • প্রশ্ন • নতুন দৃষ্টিভঙ্গি</div>
          <h1>চোখ খুলুন।<br /><em>প্রশ্ন করতে শিখুন।</em></h1>
          <p>UNBLINDED একটি স্বাধীন বাংলা জ্ঞান ও চিন্তাচর্চার প্ল্যাটফর্ম। এখানে আমরা প্রচলিত ধারণাকে প্রশ্ন করি, যুক্তিকে গুরুত্ব দিই এবং নতুন দৃষ্টিভঙ্গির জন্য জায়গা তৈরি করি।</p>
          <div className="hero-actions">
            <button className="btn" onClick={() => setPage('library')}>নিবন্ধ পড়ুন ↗</button>
            <button className="btn secondary" onClick={() => session ? setPage('write') : setPage('auth')}>আপনার ভাবনা লিখুন</button>
          </div>
        </section>

        <section className="container section">
          <div className="section-head">
            <div><div className="eyebrow">The latest thinking</div><h2>সাম্প্রতিক প্রকাশনা</h2></div>
            <button className="quiet" onClick={() => setPage('library')}>সব নিবন্ধ দেখুন ↗</button>
          </div>
          {loading ? <div className="empty">নিবন্ধ লোড হচ্ছে...</div> :
            <div className="grid">
              {published.slice(0, 6).map(article => <ArticleCard key={article.id} article={article} author={authors[article.author_id]} onClick={() => openArticle(article)} />)}
            </div>}
          {!loading && published.length === 0 && <div className="empty">এখনো কোনো প্রকাশিত নিবন্ধ নেই। প্রথম লেখাটি জমা দিন।</div>}
        </section>

        <section className="container section">
          <div className="panel row between">
            <div><div className="eyebrow">Become a contributor</div><h2>আপনার চিন্তাও গুরুত্বপূর্ণ।</h2><p className="muted">লিখুন, আলোচনা করুন, জ্ঞানের পরিসর বাড়ান।</p></div>
            <button className="btn" onClick={() => session ? setPage('write') : setPage('auth')}>লেখা জমা দিন ↗</button>
          </div>
        </section>
      </>}

      {page === 'library' && <main className="container page">
        <div className="eyebrow">Explore ideas</div><h1>নিবন্ধ ও জ্ঞানভান্ডার</h1>
        <p className="muted">ভাবনা, বিশ্লেষণ ও নতুন প্রশ্নের সংগ্রহ।</p>
        <input className="field" placeholder="নিবন্ধ খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="categories" style={{ marginTop: 20 }}>
          {CATEGORIES.map(item => <button key={item} className={`chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="grid">
          {visibleArticles.filter(a => a.status === 'published').map(article => <ArticleCard key={article.id} article={article} author={authors[article.author_id]} onClick={() => openArticle(article)} />)}
        </div>
        {!visibleArticles.some(a => a.status === 'published') && <div className="empty">কোনো নিবন্ধ পাওয়া যায়নি।</div>}
      </main>}

      {page === 'article' && selected && <main className="container page">
        <button className="quiet" onClick={() => setPage('library')}>← সব নিবন্ধে ফিরে যান</button>
        <div style={{ maxWidth: 820, margin: '45px auto' }}>
          <div className="eyebrow">{selected.category} · {new Date(selected.created_at).toLocaleDateString('bn-BD')}</div>
          <h1 className="article-title">{selected.title}</h1>
          <p className="muted">{authors[selected.author_id]?.display_name || 'UNBLINDED লেখক'}</p>
          <p style={{ color: '#c5b08c', fontSize: 18, lineHeight: 1.9 }}>{selected.excerpt}</p>
          <div className="article-body">{selected.body}</div>
          <div className="row" style={{ marginTop: 35 }}>
            <button className="btn secondary" onClick={() => reportArticle(selected.id)}>রিপোর্ট করুন</button>
          </div>

          <section style={{ marginTop: 65 }}>
            <h2>আলোচনা ({comments.filter(c => c.status === 'visible').length})</h2>
            {session ? <form className="form" onSubmit={submitComment}>
              {replyTo && <div className="notice">আপনি একটি মন্তব্যের উত্তর দিচ্ছেন। <button type="button" className="quiet" onClick={() => setReplyTo(null)}>বাতিল</button></div>}
              <textarea className="field" placeholder="আপনার মতামত লিখুন..." value={commentText} onChange={e => setCommentText(e.target.value)} required />
              <button className="btn" disabled={busy}>মন্তব্য প্রকাশ করুন</button>
            </form> : <p className="muted">মন্তব্য করতে <button className="quiet" onClick={() => setPage('auth')}>লগইন করুন</button>।</p>}
            <div style={{ marginTop: 25 }}>
              {comments.filter(c => c.status === 'visible' && !c.parent_id).map(comment => <div className="comment" key={comment.id}>
                <strong>{authors[comment.author_id]?.display_name || 'সদস্য'}</strong>
                <p>{comment.body}</p>
                <button className="quiet" onClick={() => setReplyTo(comment.id)}>উত্তর দিন</button>
                {isModerator && <button className="quiet" onClick={() => hideComment(comment.id)}>হাইড</button>}
                {comments.filter(reply => reply.parent_id === comment.id && reply.status === 'visible').map(reply => <div key={reply.id} style={{ marginLeft: 25, padding: 12, borderLeft: '2px solid #6c5737' }}>
                  <strong>{authors[reply.author_id]?.display_name |
