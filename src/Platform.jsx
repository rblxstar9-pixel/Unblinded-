import React, { useEffect, useMemo, useState } from "react";
import {
  Home, Compass, Users, MessageCircle, BookOpen, Gamepad2, Bell, Search,
  Plus, Heart, MessageSquare, Share2, Bookmark, MoreHorizontal, Image as ImageIcon,
  Send, Hash, Volume2, Headphones, Settings, LogOut, Menu, X, ChevronRight,
  Sparkles, CalendarDays, Trophy, UserRound, Globe2, PanelLeftClose
} from "lucide-react";
import QuestionBank from "./QuestionBank";
import Messages from "./Messages";
import "./platform.css";

const NAV = [
  ["home","Home",Home],["discover","Discover",Compass],["communities","Communities",Users],
  ["messages","Messages",MessageCircle],["learn","Learn",BookOpen],["gaming","Gaming",Gamepad2]
];

const initials = value => (value || "U").trim().slice(0,1).toUpperCase();
const dateLabel = value => value ? new Date(value).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : "now";

export default function Platform({supabase, session, profile, admin=false}) {
  const [page,setPage] = useState("home");
  const [posts,setPosts] = useState([]);
  const [spaces,setSpaces] = useState([]);
  const [members,setMembers] = useState([]);
  const [activeSpace,setActiveSpace] = useState(null);
  const [postText,setPostText] = useState("");
  const [spaceName,setSpaceName] = useState("");
  const [spaceAbout,setSpaceAbout] = useState("");
  const [search,setSearch] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [showCreate,setShowCreate] = useState(false);
  const [mobileMenu,setMobileMenu] = useState(false);
  const [following,setFollowing] = useState("for-you");
  const [liked,setLiked] = useState({});
  const [saved,setSaved] = useState({});
  const userId = session?.user?.id;
  const displayName = profile?.display_name || session?.user?.email?.split("@")[0] || "Member";

  const say = message => { setNotice(message); window.setTimeout(()=>setNotice(""),3200); };
  async function loadPosts() {
    const {data,error}=await supabase.from("social_posts")
      .select("id,author_id,body,created_at,profiles(display_name,avatar_url)")
      .eq("visibility","public").order("created_at",{ascending:false}).limit(60);
    if(!error) setPosts(data||[]);
  }
  async function loadSpaces() {
    const {data,error}=await supabase.from("community_spaces")
      .select("id,name,slug,description,created_at,owner_id")
      .eq("visibility","public").order("created_at",{ascending:false}).limit(60);
    if(!error) setSpaces(data||[]);
  }
  useEffect(()=>{loadPosts();loadSpaces();},[]);
  useEffect(()=>{
    if(!activeSpace)return;
    supabase.from("community_members").select("user_id,role").eq("community_id",activeSpace.id)
      .then(({data})=>setMembers(data||[]));
  },[activeSpace?.id]);
  const filteredPosts=useMemo(()=>posts.filter(p=>(p.body||"").toLowerCase().includes(search.toLowerCase())),[posts,search]);

  async function publishPost(e){
    e.preventDefault();
    if(!postText.trim())return;
    setBusy(true);
    const {error}=await supabase.from("social_posts").insert({author_id:userId,body:postText.trim(),visibility:"public"});
    setBusy(false);
    if(error)say(error.message);else{setPostText("");await loadPosts();say("Post published.");}
  }
  async function createSpace(e){
    e.preventDefault();
    if(!spaceName.trim())return;
    setBusy(true);
    const slug=spaceName.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+Date.now().toString().slice(-5);
    const {data,error}=await supabase.from("community_spaces").insert({name:spaceName.trim(),slug,description:spaceAbout.trim(),owner_id:userId})
      .select().single();
    if(!error&&data)await supabase.from("community_members").insert({community_id:data.id,user_id:userId,role:"owner"});
    setBusy(false);
    if(error)say(error.message);else{setSpaceName("");setSpaceAbout("");setShowCreate(false);await loadSpaces();say("Community created.");}
  }
  async function toggleLike(post){
    const exists=!!liked[post.id];
    setLiked(v=>({...v,[post.id]:!exists}));
    const {error}=exists
      ? await supabase.from("social_post_reactions").delete().eq("post_id",post.id).eq("user_id",userId)
      : await supabase.from("social_post_reactions").insert({post_id:post.id,user_id:userId,reaction:"like"});
    if(error){setLiked(v=>({...v,[post.id]:exists}));say(error.message);}
  }
  async function joinSpace(space){
    const {error}=await supabase.from("community_members").upsert({community_id:space.id,user_id:userId,role:"member"},{onConflict:"community_id,user_id"});
    if(error)say(error.message);else{setActiveSpace(space);say("You joined the community.");}
  }
  const Avatar=({name,size="normal"})=><div className={"platform-avatar "+size}>{initials(name)}</div>;

  return <div className="platform-shell">
    <header className="platform-topbar">
      <button className="platform-brand" onClick={()=>setPage("home")}>UNBLINDED<span>.</span></button>
      <button className="platform-mobile-toggle" onClick={()=>setMobileMenu(v=>!v)}><Menu/></button>
      <label className="platform-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people, posts and communities"/></label>
      <div className="platform-top-actions"><button title="Notifications" onClick={()=>say("You're all caught up.")}><Bell/></button><Avatar name={displayName}/></div>
    </header>
    <div className="platform-body">
      <aside className={"platform-sidebar "+(mobileMenu?"open":"")}>
        <div className="platform-sidebar-label">YOUR SPACE</div>
        {NAV.map(([id,label,Icon])=><button key={id} className={"platform-nav "+(page===id?"active":"")} onClick={()=>{setPage(id);setMobileMenu(false);setActiveSpace(null);}}><Icon size={18}/>{label}{id==="messages"&&<i/>}</button>)}
        <div className="platform-sidebar-label platform-spaces-label">YOUR COMMUNITIES <button onClick={()=>setShowCreate(true)} title="Create community"><Plus size={15}/></button></div>
        {spaces.slice(0,8).map(s=><button className="platform-space-link" key={s.id} onClick={()=>{setActiveSpace(s);setPage("communities");setMobileMenu(false);}}><span>{s.name.slice(0,1).toUpperCase()}</span>{s.name}</button>)}
        <div className="platform-sidebar-bottom"><div className="platform-account"><Avatar name={displayName}/><div><b>{displayName}</b><small>{admin?"Administrator":"Member"}</small></div><button title="Sign out" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/></button></div></div>
      </aside>
      {mobileMenu&&<button className="platform-scrim" onClick={()=>setMobileMenu(false)} aria-label="Close menu"/>}
      <main className="platform-main">
        {page==="home"&&<><div className="platform-page-heading"><div><span className="platform-eyebrow">YOUR COMMUNITY, YOUR WORLD</span><h1>Good to see you, {displayName.split(" ")[0]}.</h1><p>Find your people. Share what you're learning. Build something together.</p></div><button className="platform-primary" onClick={()=>setShowCreate(true)}><Plus size={17}/> Create community</button></div>
          <div className="platform-hero"><div><span><Sparkles size={14}/> WELCOME TO UNBLINDED</span><h2>Your people.<br/><em>Your space.</em></h2><p>One place to connect, learn, play and create.</p><button onClick={()=>setPage("discover")}>Explore communities <ChevronRight size={16}/></button></div><div className="platform-hero-orbit"><Users size={68}/><span>CONNECT · LEARN · GROW</span></div></div>
          <div className="platform-feed-layout"><section className="platform-feed-column">
            <form className="platform-composer" onSubmit={publishPost}><div className="platform-composer-top"><Avatar name={displayName}/><textarea value={postText} onChange={e=>setPostText(e.target.value)} placeholder="What's happening in your world?" rows={2}/></div><div className="platform-composer-actions"><span><ImageIcon size={16}/> Photos & media coming soon</span><button className="platform-primary" disabled={busy||!postText.trim()}><Send size={15}/> Post</button></div></form>
            <div className="platform-feed-tabs"><b>Your feed</b><div><button className={following==="for-you"?"selected":""} onClick={()=>setFollowing("for-you")}>For you</button><button className={following==="following"?"selected":""} onClick={()=>setFollowing("following")}>Following</button></div></div>
            {filteredPosts.map(post=><article className="platform-post" key={post.id}><div className="platform-post-head"><Avatar name={post.profiles?.display_name}/><div><b>{post.profiles?.display_name||"UNBLINDED member"}</b><small>{dateLabel(post.created_at)} · Community member</small></div><button className="platform-more"><MoreHorizontal/></button></div><p>{post.body}</p><div className="platform-post-actions"><button className={liked[post.id]?"liked":""} onClick={()=>toggleLike(post)}><Heart size={17}/>{liked[post.id]?"Liked":"Like"}</button><button onClick={()=>say("Comments are being added next.")}><MessageSquare size={17}/> Comment</button><button onClick={()=>{navigator.clipboard?.writeText(post.body);say("Post copied.");}}><Share2 size={17}/> Share</button><button className={saved[post.id]?"liked":""} onClick={()=>setSaved(v=>({...v,[post.id]:!v[post.id]}))}><Bookmark size={17}/></button></div></article>)}
            {!filteredPosts.length&&<div className="platform-empty"><Users size={30}/><h3>Your feed starts here</h3><p>Be the first to share an idea, a question or a small win.</p></div>}
          </section><aside className="platform-right-rail"><section className="platform-rail-card"><div className="platform-rail-title">Discover communities <button onClick={()=>setPage("discover")}>See all</button></div>{spaces.slice(0,4).map(s=><button className="platform-suggested-space" key={s.id} onClick={()=>{setActiveSpace(s);setPage("communities");}}><span>{s.name.slice(0,1)}</span><div><b>{s.name}</b><small>{s.description||"A place to connect"}</small></div><ChevronRight size={15}/></button>)}{!spaces.length&&<p className="platform-muted">New communities will appear here.</p>}</section><section className="platform-rail-card platform-rail-live"><span className="platform-live-dot"/> COMMUNITY ACTIVITY<h3>Make a little noise.</h3><p>Start a discussion, find a study partner or invite friends.</p><button onClick={()=>setPage("communities")}>Explore spaces <ChevronRight size={15}/></button></section><section className="platform-rail-card"><div className="platform-rail-title">Your shortcuts</div><button className="platform-shortcut" onClick={()=>setPage("learn")}><BookOpen/> Study & learn</button><button className="platform-shortcut" onClick={()=>setPage("gaming")}><Gamepad2/> Gaming</button><button className="platform-shortcut" onClick={()=>setPage("messages")}><MessageCircle/> Messages</button></section></aside></div>
        </>}
        {page==="discover"&&<><div className="platform-page-heading"><div><span className="platform-eyebrow">FIND YOUR PEOPLE</span><h1>Discover</h1><p>Communities for learning, gaming, creating and everything in between.</p></div><button className="platform-primary" onClick={()=>setShowCreate(true)}><Plus size={17}/> Create community</button></div><div className="platform-space-grid">{spaces.map(s=><article className="platform-space-card" key={s.id}><div className="platform-space-cover"><Users size={30}/></div><h3>{s.name}</h3><p>{s.description||"A community built around shared interests."}</p><div className="platform-space-card-foot"><small>UNBLINDED community</small><button onClick={()=>joinSpace(s)}>Join <ChevronRight size={14}/></button></div></article>)}</div>{!spaces.length&&<div className="platform-empty"><Globe2/><h3>No communities yet</h3><p>Create the first community and invite your people.</p><button className="platform-primary" onClick={()=>setShowCreate(true)}>Create a community</button></div>}</>}
        {page==="communities"&&<><div className="platform-page-heading"><div><span className="platform-eyebrow">COMMUNITY SPACE</span><h1>{activeSpace?.name||"Communities"}</h1><p>{activeSpace?.description||"Find a place to share ideas and connect."}</p></div><button className="platform-primary" onClick={()=>setShowCreate(true)}><Plus size={17}/> New community</button></div>{activeSpace?<div className="platform-community-detail"><div className="platform-community-banner"><div><span>COMMUNITY</span><h2>{activeSpace.name}</h2><p>{activeSpace.description}</p></div><div className="platform-community-actions"><button onClick={()=>say("Text channels are next in the rollout.")}><Hash/> general</button><button onClick={()=>say("Voice rooms need the calling service connection.")}><Volume2/> Join voice</button></div></div><div className="platform-channel-layout"><aside><b>TEXT CHANNELS</b><span><Hash size={15}/> general</span><span><Hash size={15}/> introductions</span><span><Hash size={15}/> resources</span><b>VOICE CHANNELS</b><span><Volume2 size={15}/> Study room</span><span><Headphones size={15}/> Hangout</span></aside><section><div className="platform-community-welcome"><Users/><h3>Welcome to {activeSpace.name}</h3><p>Start the conversation and make this space yours.</p><button className="platform-primary" onClick={()=>say("Community messaging is the next module.")}>Start chatting</button></div><div className="platform-member-count">{members.length} members · Community space</div></section></div></div>:<div className="platform-space-grid">{spaces.map(s=><article className="platform-space-card" key={s.id}><div className="platform-space-cover"><Users size={30}/></div><h3>{s.name}</h3><p>{s.description}</p><button className="platform-primary" onClick={()=>joinSpace(s)}>Open community</button></article>)}</div>}</>}
        {page==="messages"&&<><div className="platform-page-heading"><div><span className="platform-eyebrow">STAY IN TOUCH</span><h1>Messages</h1><p>Your conversations, all in one place.</p></div></div><div className="platform-embedded-messages"><Messages supabase={supabase} onClose={()=>setPage("home")}/></div></>}
        {page==="learn"&&<><div className="platform-page-heading"><div><span className="platform-eyebrow">LEARN SOMETHING NEW</span><h1>UNBLINDED Learn</h1><p>Study resources, SSC practice and your next breakthrough.</p></div></div><div className="platform-learn-tabs"><div><BookOpen/><b>SSC Question Bank</b><span>Board questions and chapter-wise practice</span></div></div><QuestionBank supabase={supabase} session={session} admin={admin}/></>}
        {page==="gaming"&&<><div className="platform-page-heading"><div><span className="platform-eyebrow">PLAY TOGETHER</span><h1>Gaming</h1><p>Find teammates, build squads and compete together.</p></div></div><div className="platform-coming-grid"><div><Gamepad2/><h3>Gaming communities</h3><p>Find people who play your favourite games.</p></div><div><Trophy/><h3>Tournaments</h3><p>Community competitions and leaderboards are on the roadmap.</p></div></div></>}
      </main>
      <aside className="platform-member-rail"><div className="platform-member-rail-head">YOUR PROFILE <button onClick={()=>say("Profile editing will be added in the next module.")}><Settings size={15}/></button></div><div className="platform-profile-card"><Avatar name={displayName} size="large"/><h3>{displayName}</h3><p>{session.user.email}</p><span>UNBLINDED MEMBER</span></div><div className="platform-member-rail-head">YOUR COMMUNITIES <span>{spaces.length}</span></div>{spaces.slice(0,5).map(s=><button className="platform-rail-community" key={s.id} onClick={()=>{setActiveSpace(s);setPage("communities");}}><span>{s.name.slice(0,1)}</span>{s.name}</button>)}<div className="platform-rail-note"><Sparkles size={16}/><p>Good communities are built by the people in them. Be kind, stay curious.</p></div></aside>
    </div>
    {showCreate&&<div className="platform-modal-backdrop"><form className="platform-modal" onSubmit={createSpace}><button type="button" className="platform-modal-close" onClick={()=>setShowCreate(false)}><X/></button><span className="platform-eyebrow">START SOMETHING</span><h2>Create a community</h2><p>Bring people together around an interest, goal or game.</p><label>Community name<input value={spaceName} onChange={e=>setSpaceName(e.target.value)} required maxLength={60} placeholder="e.g. SSC Study Circle"/></label><label>Description<textarea value={spaceAbout} onChange={e=>setSpaceAbout(e.target.value)} rows={3} maxLength={240} placeholder="What is this community about?"/></label><button className="platform-primary" disabled={busy}>{busy?"Creating...":"Create community"}</button></form></div>}
    {notice&&<div className="platform-toast">{notice}</div>}
  </div>;
}
