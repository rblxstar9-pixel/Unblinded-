import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, configured } from './supabase';
import './style.css';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [chat, setChat] = useState([]);
  const [page, setPage] = useState('home');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('সব');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [message, setMessage] = useState('');

  const notify = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configured) return;
    loadArticles();
    loadChat();
    const channel = supabase
      .channel('unblinded-live-chat')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages'
      }, loadChat)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (session) loadProfile();
    else setProfile(null);
  }, [session]);

  useEffect(() => {
    if (selected) loadComments(selected.id);
  }, [selected]);

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    setProfile(data);
  }

  async function loadArticles() {
    const { data, error } = await supabase
      .from('articles')
      .select('*, profiles(display_name, avatar_url)')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (error) return notify(error.message);
    setArticles(data || []);
  }

  async function loadComments(id) {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(display_name)')
      .eq('article_id', id)
      .order('created_at', { ascending: true });
    setComments(data || []);
  }

  async function loadChat() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles(display_name)')
      .eq('hidden', false)
      .order('created_at', { ascending: true })
      .limit(100);
    setChat(data || []);
  }

  async function signIn(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email, password
    });
    setLoading(false);
    if (error) notify(error.message);
    else {
      notify('সফলভাবে প্রবেশ করেছেন');
      setPage('home');
    }
  }

  async function signUp(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } }
    });
    setLoading(false);
    if (error) notify(error.message);
    else notify('নিবন্ধন সম্পন্ন! ইমেইল যাচাই করুন।');
  }

  async function logout() {
    await supabase.auth.signOut();
    setPage('home');
    notify('আপনি লগআউট করেছেন');
  }

  async function submitArticle(e) {
    e.preventDefault();
    if (!session) return setPage('login');
    const { error } = await supabase.from('articles').insert({
      title,
      excerpt: summary,
      body,
      author_id: session.user.id,
      category,
      status: 'pending'
    });
    if (error) return notify(error.message);
    setTitle('');
    setSummary('');
    setBody('');
    notify('লেখাটি সম্পাদকের অনুমোদনের জন্য পাঠানো হয়েছে');
    setPage('home');
  }

  async function sendComment(e) {
    e.preventDefault();
    if (!session) return setPage('login');
    const { error } = await supabase.from('comments').insert({
      article_id: selected.id,
      author_id: session.user.id,
      parent_id: replyTo,
      body: comment
    });
    if (error) return notify(error.message);
    setComment('');
    setReplyTo(null);
    loadComments(selected.id);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!session) return setPage('login');
    if (!message.trim()) return;
    const { error } = await supabase.from('chat_messages').insert({
      user_id: session.user.id,
      content: message.trim()
    });
    if (error) notify(error.message);
    else {
      setMessage('');
      loadChat();
    }
  }

  async function report(type, id) {
    if (!session) return setPage('login');
    const reason = prompt('অভিযোগের কারণ লিখুন:');
    if (!reason) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      target_type: type,
      target_id: id,
      reason
    });
    notify(error ? error.message : 'অভিযোগ জমা হয়েছে');
  }

  async function moderate(id, status) {
    const { error } = await supabase
      .from('articles')
      .update({ status })
      .eq('id', id);
    if (error) notify(error.message);
    else {
      notify('আপডেট সম্পন্ন');
      loadArticles();
    }
  }

  const isModerator = ['admin', 'moderator'].includes(profile?.role);
  const categories = ['সব', 'ধর্ম', 'দর্শন', 'ইতিহাস', 'সমাজ', 'মতামত'];

  const visible = articles.filter(a => {
    const match = `${a.title} ${a.excerpt} ${a.body}`
      .toLowerCase().includes(search.toLowerCase());
    return match && (category === 'সব' || a.category === category);
  });

  if (!configured) {
    return <div className="setup"><div className="setupcard">
      <div className="brand">un<span>blinded</span></div>
      <h1>ওয়েবসাইট সংযোগের অপেক্ষায়</h1>
      <p>Vercel-এর Environment Variables-এ Supabase URL এবং Publishable Key যোগ করুন।</p>
    </div></div>;
  }

  return <div className="app">
    <div className="topline">চিন্তার স্বাধীনতা • জ্ঞানের গভীরতা • সম্মানজনক সংলাপ</div>

    <header className="container nav">
      <a className="brand" onClick={() => {setPage('home');setSelected(null)}}>un<span>blinded</span>.</a>
      <button className="mobile" onClick={() => setMenu(!menu)}>☰</button>
      <nav className={menu ? 'open' : ''}>
        <a onClick={() => {setPage('home');setSelected(null)}}>প্রচ্ছদ</a>
        <a onClick={() => setPage('chat')}>কমিউনিটি</a>
        <a onClick={() => setPage('write')}>লিখুন</a>
        {isModerator && <a onClick={() => setPage('moderation')}>সম্পাদনা</a>}
      </nav>
      <div className="navright">
        {session
          ? <button className="subtle" onClick={() => setPage('profile')}>{profile?.display_name || 'প্রোফাইল'}</button>
          : <button className="goldbtn" onClick={() => setPage('login')}>প্রবেশ</button>}
      </div>
    </header>

    {page === 'home' && <>
      <main className="container">
        <section className="hero">
          <div>
            <div className="eyebrow">বাংলা চিন্তা ও মননের স্বাধীন মঞ্চ</div>
            <h1>প্রশ্ন করুন।<br/><em>ভাবুন।</em> নতুনভাবে দেখুন।</h1>
            <p>ধর্ম, দর্শন, ইতিহাস ও মানবচিন্তা নিয়ে যুক্তিনির্ভর আলোচনা এবং মুক্ত জ্ঞানচর্চার একটি সম্মানজনক প্ল্যাটফর্ম।</p>
            <div className="actions">
              <button className="goldbtn" onClick={() => setPage('write')}>আপনার লেখা জমা দিন ↗</button>
              <button className="outlinebtn" onClick={() => setPage('chat')}>কমিউনিটিতে যোগ দিন</button>
            </div>
          </div>
          <div className="heroart"><span>অ</span><small>THINK BEYOND THE OBVIOUS</small></div>
        </section>
        <div className="principle">“মতভিন্নতা থাকুক, অসম্মান নয়।”</div>
      </main>

      <section className="container section">
        <div className="sectionhead">
          <div><div className="eyebrow">THE JOURNAL</div><h2>সাম্প্রতিক প্রকাশনা</h2>
            <p>চিন্তার জগতে নতুন সংযোজন</p></div>
          <button className="outlinebtn" onClick={() => setPage('write')}>লেখা জমা দিন</button>
        </div>
        <div className="toolbar">
          <div className="search">⌕ <input placeholder="লেখা খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)}/></div>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="articles">
          {visible.map(a => <article className="article" key={a.id} onClick={() => {setSelected(a);setPage('article')}}>
            <div className="eyebrow">{a.category || 'প্রবন্ধ'}</div>
            <h3>{a.title}</h3>
            <p>{a.excerpt}</p>
            <div className="byline"><span>{a.profiles?.display_name || 'লেখক'}</span><span>{new Date(a.created_at).toLocaleDateString('bn-BD')}</span></div>
          </article>)}
        </div>
        {!visible.length && <div className="empty">এখনো কোনো প্রকাশিত লেখা পাওয়া যায়নি।<br/>আপনিই হতে পারেন প্রথম লেখক।</div>}
      </section>

      <section className="joinband">
        <h2>আপনার চিন্তাও গুরুত্বপূর্ণ।</h2>
        <p>জ্ঞান, যুক্তি ও সংলাপের যাত্রায় আমাদের সঙ্গে থাকুন।</p>
        <button className="darkbtn" onClick={() => setPage('signup')}>সদস্য হোন</button>
      </section>
    </>}

    {page === 'login' && <div className="container panel narrow">
      <h1>স্বাগতম</h1><p>আপনার অ্যাকাউন্টে প্রবেশ করুন।</p>
      <form onSubmit={signIn}>
        <input className="field" type="email" placeholder="ইমেইল" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <input className="field" type="password" placeholder="পাসওয়ার্ড" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <button className="goldbtn full" disabled={loading}>প্রবেশ করুন</button>
      </form>
      <p>নতুন এখানে? <a className="goldlink" onClick={()=>setPage('signup')}>নিবন্ধন করুন</a></p>
    </div>}

    {page === 'signup' && <div className="container panel narrow">
      <h1>নতুন সদস্য হোন</h1><p>জ্ঞানচর্চার কমিউনিটিতে স্বাগতম।</p>
      <form onSubmit={signUp}>
        <input className="field" placeholder="আপনার নাম" value={name} onChange={e=>setName(e.target.value)} required/>
        <input className="field" type="email" placeholder="ইমেইল" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <input className="field" type="password" minLength="8" placeholder="কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড" value={password} onChange={e=>setPassword(e.target.value)} required/>
        <button className="goldbtn full" disabled={loading}>অ্যাকাউন্ট তৈরি করুন</button>
      </form>
      <p>আগে থেকেই সদস্য? <a className="goldlink" onClick={()=>setPage('login')}>প্রবেশ করুন</a></p>
    </div>}

    {page === 'write' && <div className="container panel narrow">
      <div className="eyebrow">CONTRIBUTE</div><h1>আপনার লেখা জমা দিন</h1>
      <p>প্রতিটি লেখা প্রকাশের আগে সম্পাদকীয় পর্যালোচনার মধ্য দিয়ে যাবে।</p>
      <form onSubmit={submitArticle}>
        <input className="field" placeholder="লেখার শিরোনাম" value={title} onChange={e=>setTitle(e.target.value)} required/>
        <select className="field" value={category} onChange={e=>setCategory(e.target.value)}>
          {categories.filter(c=>c!=='সব').map(c=><option key={c}>{c}</option>)}
        </select>
        <textarea className="field" rows="3" placeholder="সংক্ষিপ্ত পরিচিতি" value={summary} onChange={e=>setSummary(e.target.value)} required/>
        <textarea className="field" rows="12" placeholder="আপনার সম্পূর্ণ লেখা..." value={body} onChange={e=>setBody(e.target.value)} required/>
        <button className="goldbtn">পর্যালোচনার জন্য জমা দিন</button>
      </form>
    </div>}

    {page === 'article' && selected && <main className="reading">
      <button className="back" onClick={()=>{setPage('home');setSelected(null)}}>← সব লেখা</button>
      <div className="eyebrow">{selected.category}</div>
      <h1>{selected.title}</h1>
      <p className="muted">লেখক: {selected.profiles?.display_name || 'লেখক'} · {new Date(selected.created_at).toLocaleDateString('bn-BD')}</p>
      <div className="articlebody">{selected.body}</div>
      <button className="report" onClick={()=>report('article',selected.id)}>⚑ এই লেখা সম্পর্কে অভিযোগ</button>
      <div className="comments">
        <h2>মন্তব্য ({comments.length})</h2>
        <form onSubmit={sendComment}>
          {replyTo && <p>একটি মন্তব্যের উত্তর দিচ্ছেন <button type="button" className="report" onClick={()=>setReplyTo(null)}>বাতিল</button></p>}
          <textarea className="field" rows="3" placeholder="আপনার মতামত লিখুন..." value={comment} onChange={e=>setComment(e.target.value)} required/>
          <button className="goldbtn">মন্তব্য প্রকাশ করুন</button>
        </form>
        {comments.filter(c=>!c.parent_id).map(c=><div className="comment" key={c.id}>
          <b>{c.profiles?.display_name || 'সদস্য'}</b><p>{c.body}</p>
          <button className="report" onClick={()=>setReplyTo(c.id)}>উত্তর দিন</button>
          <button className="report" onClick={()=>report('comment',c.id)}>অভিযোগ</button>
          {comments.filter(r=>r.parent_id===c.id).map(r=><div className="reply" key={r.id}>
            <b>{r.profiles?.display_name || 'সদস্য'}</b><p>{r.body}</p>
          </div>)}
        </div>)}
      </div>
    </main>}

    {page === 'chat' && <div className="container section">
      <div className="eyebrow">COMMUNITY</div><h1>মুক্ত আলোচনা</h1>
      <p className="muted">মতভিন্নতাকে সম্মান করুন। ব্যক্তিগত আক্রমণ ও হয়রানি গ্রহণযোগ্য নয়।</p>
      <div className="chatbox">
        {chat.map(m=><div className="chatmsg" key={m.id}>
          <b>{m.profiles?.display_name || 'সদস্য'}</b>
          <small> · {new Date(m.created_at).toLocaleTimeString('bn-BD')}</small>
          <p>{m.content}</p>
        </div>)}
        {!chat.length && <p className="muted">আলোচনা শুরু করুন।</p>}
      </div>
      <form className="chatform" onSubmit={sendMessage}>
        <input className="field" placeholder="আপনার বার্তা লিখুন..." value={message} onChange={e=>setMessage(e.target.value)}/>
        <button className="goldbtn">পাঠান</button>
      </form>
    </div>}

    {page === 'profile' && <div className="container panel narrow">
      <h1>আপনার প্রোফাইল</h1>
      <div className="profilebox"><div className="avatar placeholder">অ</div><div><b>{profile?.display_name || 'সদস্য'}</b><p>{session?.user?.email}</p><small>{profile?.role || 'member'}</small></div></div>
      <button className="outlinebtn" onClick={logout}>লগআউট</button>
    </div>}

    {page === 'moderation' && isModerator && <div className="container section">
      <h1>সম্পাদকীয় নিয়ন্ত্রণ</h1>
      <p className="muted">প্রকাশিত লেখাগুলো এখানে পরিচালনা করুন।</p>
      <button className="outlinebtn" onClick={async()=>{const {data}=await supabase.from('articles').select('*,profiles(display_name)').eq('status','pending');setArticles(data||[]);}}>অপেক্ষমাণ লেখা দেখুন</button>
      {articles.map(a=><div className="moderow" key={a.id}>
        <div><b>{a.title}</b><p>{a.profiles?.display_name}</p></div>
        <div className="modactions">
          <button className="goldbtn" onClick={()=>moderate(a.id,'published')}>অনুমোদন</button>
          <button className="outlinebtn" onClick={()=>moderate(a.id,'rejected')}>প্রত্যাখ্যান</button>
        </div>
      </div>)}
    </div>}

    <footer className="container">
      <div className="brand">un<span>blinded</span>.</div>
      <div>© {new Date().getFullYear()} unblinded — চিন্তার স্বাধীন মঞ্চ</div>
      <div>সম্মান • যুক্তি • জ্ঞান</div>
    </footer>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
     
