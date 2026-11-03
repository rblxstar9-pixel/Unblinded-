import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react';

import {
  Hash,
  Volume2,
  Plus,
  Search,
  Compass,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Send,
  Smile,
  Pin,
  Reply,
  Pencil,
  Trash2,
  MoreHorizontal,
  Shield,
  Crown,
  UserPlus,
  LogOut,
  Copy,
  Check,
  X,
  Menu,
  MessageSquare,
  Megaphone,
  Link,
  Lock,
  Globe,
  RefreshCw,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  User,
  Ban
} from 'lucide-react';

import './servers-hub.css';

const EMOJIS = ['❤️', '🔥', '😂', '👏', '💯', '😍', '🤔', '🎉'];

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getInitials = (name = 'U') =>
  name.trim().slice(0, 2).toUpperCase();

const errorMessage = (error) =>
  error?.message || 'Something went wrong. Please try again.';

export default function ServersHub({ supabase, session, profile }) {
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [servers, setServers] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);

  const [view, setView] = useState('servers');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMembers, setShowMembers] = useState(true);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showEmoji, setShowEmoji] = useState(null);
  const [menuMessage, setMenuMessage] = useState(null);

  const [messageText, setMessageText] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState('');

  const [serverForm, setServerForm] = useState({
    name: '',
    description: '',
    is_public: true
  });

  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    channel_type: 'text'
  });

  const messageEndRef = useRef(null);
  const inputRef = useRef(null);

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    session?.user?.email?.split('@')[0] ||
    'Member';

  const avatarUrl =
    profile?.avatar_url ||
    profile?.avatar ||
    null;

  const isOwner =
    !!activeServer && activeServer.owner_id === userId;

  const myMembership = useMemo(
    () => members.find((member) => member.user_id === userId),
    [members, userId]
  );

  const myPermissions = useMemo(() => {
    if (isOwner) {
      return {
        manage_roles: true,
        manage_members: true,
        manage_channels: true,
        manage_messages: true,
        view_channels: true,
        send_messages: true
      };
    }

    return myMembership?.role?.permissions || {};
  }, [isOwner, myMembership]);

  const can = (permission) =>
    isOwner || myPermissions?.[permission] === true;

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const fail = (error) => {
    console.error('[UNBLINDED Servers]', error);
    setError(errorMessage(error));
  };

  const loadServers = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: memberships, error: memberError } =
        await supabase
          .from('ub_server_members')
          .select('server_id')
          .eq('user_id', userId);

      if (memberError) throw memberError;

      const ids = (memberships || []).map((item) => item.server_id);

      let joined = [];

      if (ids.length) {
        const { data, error: serverError } = await supabase
          .from('ub_servers')
          .select('*')
          .in('id', ids)
          .order('created_at', { ascending: false });

        if (serverError) throw serverError;
        joined = data || [];
      }

      setServers(joined);

      const { data: publicServers, error: discoverError } =
        await supabase
          .from('ub_servers')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(30);

      if (discoverError) throw discoverError;

      setDiscovered(
        (publicServers || []).filter(
          (server) => !ids.includes(server.id)
        )
      );
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const loadMembers = useCallback(async (serverId) => {
    if (!serverId) return;

    const { data: memberRows, error: memberError } = await supabase
      .from('ub_server_members')
      .select('id, user_id, role_id, nickname, joined_at')
      .eq('server_id', serverId);

    if (memberError) throw memberError;

    const rows = memberRows || [];
    const userIds = rows.map((row) => row.user_id);

    let profiles = [];

    if (userIds.length) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profileError) {
        console.warn('Could not load member profiles:', profileError);
      } else {
        profiles = data || [];
      }
    }

    const { data: roles, error: roleError } = await supabase
      .from('ub_server_roles')
      .select('*')
      .eq('server_id', serverId);

    if (roleError) throw roleError;

    const enriched = rows.map((member) => ({
      ...member,
      profile: profiles.find((p) => p.id === member.user_id) || null,
      role: (roles || []).find((r) => r.id === member.role_id) || null
    }));

    setMembers(enriched);
  }, [supabase]);

  const loadChannels = useCallback(async (serverId) => {
    if (!serverId) return;

    const { data, error: channelError } = await supabase
      .from('ub_server_channels')
      .select('*')
      .eq('server_id', serverId)
      .order('position', { ascending: true });

    if (channelError) throw channelError;

    const visible = data || [];
    setChannels(visible);

    setActiveChannel((current) => {
      if (current && visible.some((c) => c.id === current.id)) {
        return visible.find((c) => c.id === current.id);
      }
      return visible[0] || null;
    });
  }, [supabase]);

  const openServer = async (server) => {
    setError('');
    setActiveServer(server);
    setActiveChannel(null);
    setMessages([]);
    setView('server');
    setShowDiscover(false);
    setShowSettings(false);

    try {
      await Promise.all([
        loadChannels(server.id),
        loadMembers(server.id)
      ]);
    } catch (err) {
      fail(err);
    }
  };

  const createServer = async (event) => {
    event.preventDefault();

    if (!serverForm.name.trim()) return;

    setBusy(true);
    setError('');

    try {
      const { data, error: createError } = await supabase
        .from('ub_servers')
        .insert({
          name: serverForm.name.trim(),
          description: serverForm.description.trim(),
          owner_id: userId,
          is_public: serverForm.is_public
        })
        .select()
        .single();

      if (createError) throw createError;

      setShowCreateServer(false);
      setServerForm({
        name: '',
        description: '',
        is_public: true
      });

      await loadServers();
      await openServer(data);
      notify('Your server is ready.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const joinPublicServer = async (server) => {
    setBusy(true);
    setError('');

    try {
      const { error: joinError } = await supabase.rpc(
        'ub_join_public_server',
        { p_server: server.id }
      );

      if (joinError) throw joinError;

      await loadServers();
      await openServer(server);
      notify(`Joined ${server.name}.`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const joinInvite = async (event) => {
    event.preventDefault();

    if (!inviteCode.trim()) return;

    setBusy(true);
    setError('');

    try {
      const { error: joinError } = await supabase.rpc(
        'ub_join_server_invite',
        { p_code: inviteCode.trim() }
      );

      if (joinError) throw joinError;

      setInviteCode('');
      setShowInvite(false);
      await loadServers();
      notify('You joined the server.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
    const loadMessages = useCallback(async (channelId) => {
    if (!channelId) {
      setMessages([]);
      return;
    }

    const { data, error: messageError } = await supabase
      .from('ub_server_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (messageError) throw messageError;

    const rows = data || [];
    const authorIds = [...new Set(rows.map((m) => m.author_id))];

    let profiles = [];

    if (authorIds.length) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);

      profiles = profileRows || [];
    }

    const messageIds = rows.map((m) => m.id);
    let reactions = [];

    if (messageIds.length) {
      const { data: reactionRows } = await supabase
        .from('ub_server_message_reactions')
        .select('*')
        .in('message_id', messageIds);

      reactions = reactionRows || [];
    }

    setMessages(
      rows.map((message) => ({
        ...message,
        author:
          profiles.find((p) => p.id === message.author_id) || null,
        reactions: reactions.filter(
          (r) => r.message_id === message.id
        )
      }))
    );
  }, [supabase]);

  useEffect(() => {
    if (!activeChannel?.id) {
      setMessages([]);
      return;
    }

    let alive = true;

    const refresh = async () => {
      try {
        await loadMessages(activeChannel.id);
      } catch (err) {
        if (alive) fail(err);
      }
    };

    refresh();

    const subscription = supabase
      .channel(`ub-server-chat-${activeChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ub_server_messages',
          filter: `channel_id=eq.${activeChannel.id}`
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(subscription);
    };
  }, [activeChannel?.id, supabase, loadMessages]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }, [messages]);

  const sendMessage = async (event) => {
    event?.preventDefault();

    const body = messageText.trim();

    if (!body || !activeChannel || busy) return;

    setBusy(true);
    setError('');

    try {
      if (editingMessage) {
        const { error: editError } = await supabase
          .from('ub_server_messages')
          .update({
            body,
            is_edited: true,
            edited_at: new Date().toISOString()
          })
          .eq('id', editingMessage.id);

        if (editError) throw editError;

        setEditingMessage(null);
        notify('Message edited.');
      } else {
        const payload = {
          channel_id: activeChannel.id,
          author_id: userId,
          body
        };

        if (replyingTo) {
          payload.reply_to = replyingTo.id;
        }

        const { error: sendError } = await supabase
          .from('ub_server_messages')
          .insert(payload);

        if (sendError) throw sendError;

        setReplyingTo(null);
      }

      setMessageText('');
      await loadMessages(activeChannel.id);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteMessage = async (message) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('ub_server_messages')
        .delete()
        .eq('id', message.id);

      if (deleteError) throw deleteError;

      await loadMessages(activeChannel.id);
      notify('Message deleted.');
    } catch (err) {
      fail(err);
    }
  };

  const togglePin = async (message) => {
    try {
      const { error: pinError } = await supabase
        .from('ub_server_messages')
        .update({ is_pinned: !message.is_pinned })
        .eq('id', message.id);

      if (pinError) throw pinError;

      await loadMessages(activeChannel.id);
      notify(message.is_pinned ? 'Message unpinned.' : 'Message pinned.');
    } catch (err) {
      fail(err);
    }
  };

  const toggleReaction = async (message, emoji) => {
    const existing = (message.reactions || []).find(
      (r) => r.user_id === userId && r.emoji === emoji
    );

    try {
      if (existing) {
        const { error: removeError } = await supabase
          .from('ub_server_message_reactions')
          .delete()
          .eq('id', existing.id);

        if (removeError) throw removeError;
      } else {
        const { error: addError } = await supabase
          .from('ub_server_message_reactions')
          .insert({
            message_id: message.id,
            user_id: userId,
            emoji
          });

        if (addError) throw addError;
      }

      await loadMessages(activeChannel.id);
      setShowEmoji(null);
    } catch (err) {
      fail(err);
    }
  };

  const startEdit = (message) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setMessageText(message.body);
    setMenuMessage(null);
    inputRef.current?.focus();
  };

  const startReply = (message) => {
    setReplyingTo(message);
    setEditingMessage(null);
    setMenuMessage(null);
    inputRef.current?.focus();
  };

  const createChannel = async (event) => {
    event.preventDefault();

    if (!channelForm.name.trim() || !activeServer) return;

    setBusy(true);
    setError('');

    try {
      const { data, error: channelError } = await supabase
        .from('ub_server_channels')
        .insert({
          server_id: activeServer.id,
          name: channelForm.name.trim().toLowerCase().replace(/\s+/g, '-'),
          description: channelForm.description.trim(),
          channel_type: channelForm.channel_type,
          position: channels.length,
          created_by: userId
        })
        .select()
        .single();

      if (channelError) throw channelError;

      setChannels((current) => [...current, data]);
      setActiveChannel(data);
      setShowCreateChannel(false);
      setChannelForm({
        name: '',
        description: '',
        channel_type: 'text'
      });

      notify('Channel created.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async () => {
    if (!activeServer) return;

    setBusy(true);
    setError('');

    try {
      const { data, error: inviteError } = await supabase
        .from('ub_server_invites')
        .insert({
          server_id: activeServer.id,
          created_by: userId
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      const inviteUrl =
        `${window.location.origin}/?server-invite=${data.code}`;

      setGeneratedInvite(inviteUrl);
      setShowInvite(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(generatedInvite);
      notify('Invite link copied.');
    } catch {
      fail(new Error('Could not copy the invite link.'));
    }
  };

  const leaveServer = async () => {
    if (!activeServer || isOwner) return;

    if (!window.confirm(`Leave ${activeServer.name}?`)) return;

    try {
      const { error: leaveError } = await supabase
        .from('ub_server_members')
        .delete()
        .eq('server_id', activeServer.id)
        .eq('user_id', userId);

      if (leaveError) throw leaveError;

      setActiveServer(null);
      setActiveChannel(null);
      setMessages([]);
      setView('servers');
      await loadServers();
      notify('You left the server.');
    } catch (err) {
      fail(err);
    }
  };

  const removeMember = async (member) => {
    if (!activeServer || !can('manage_members')) return;
    if (member.user_id === userId) return;

    const name =
      member.profile?.display_name ||
      member.profile?.username ||
      'this member';

    if (!window.confirm(`Remove ${name} from this server?`)) return;

    try {
      const { error: logError } = await supabase
        .from('ub_server_moderation')
        .insert({
          server_id: activeServer.id,
          moderator_id: userId,
          target_user_id: member.user_id,
          action: 'kick',
          reason: 'Removed by a server moderator.'
        });

      if (logError) throw logError;

      const { error: removeError } = await supabase
        .from('ub_server_members')
        .delete()
        .eq('server_id', activeServer.id)
        .eq('user_id', member.user_id);

      if (removeError) throw removeError;

      await loadMembers(activeServer.id);
      notify('Member removed.');
    } catch (err) {
      fail(err);
    }
  };

  const banMember = async (member) => {
    if (!activeServer || !can('manage_members')) return;
    if (member.user_id === userId) return;

    const reason = window.prompt('Reason for the ban?');
    if (reason === null) return;

    try {
      const { error: banError } = await supabase
        .from('ub_server_bans')
        .insert({
          server_id: activeServer.id,
          user_id: member.user_id,
          banned_by: userId,
          reason
        });

      if (banError) throw banError;

      const { error: removeError } = await supabase
        .from('ub_server_members')
        .delete()
        .eq('server_id', activeServer.id)
        .eq('user_id', member.user_id);

      if (removeError) throw removeError;

      await supabase
        .from('ub_server_moderation')
        .insert({
          server_id: activeServer.id,
          moderator_id: userId,
          target_user_id: member.user_id,
          action: 'ban',
          reason
        });

      await loadMembers(activeServer.id);
      notify('Member banned.');
    } catch (err) {
      fail(err);
    }
  };

  const filteredDiscover = discovered.filter((server) =>
    `${server.name} ${server.description || ''}`
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );

  const selectChannel = (channel) => {
    setActiveChannel(channel);
    setMessages([]);
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageText('');
  };

  const getMemberName = (member) =>
    member.nickname ||
    member.profile?.display_name ||
    member.profile?.full_name ||
    member.profile?.username ||
    'Member';

  const getAuthorName = (message) => {
    const author = message.author;
    return (
      author?.display_name ||
      author?.full_name ||
      author?.username ||
      (message.author_id === userId ? displayName : 'Member')
    );
  };
    if (!userId) {
    return (
      <div className="ub-server-empty">
        <Shield size={38} />
        <h2>Community starts with you.</h2>
        <p>Sign in to explore and join UNBLINDED servers.</p>
      </div>
    );
  }

  return (
    <div className="ub-servers">
      {/* SERVER RAIL */}
      <aside className="ub-server-rail">
        <button
          className="ub-rail-home"
          title="Your servers"
          onClick={() => {
            setView('servers');
            setActiveServer(null);
          }}
        >
          <Sparkles size={22} />
        </button>

        <div className="ub-rail-divider" />

        {servers.map((server) => (
          <button
            key={server.id}
            className={`ub-rail-server ${
              activeServer?.id === server.id ? 'active' : ''
            }`}
            title={server.name}
            onClick={() => openServer(server)}
          >
            {server.icon_url ? (
              <img src={server.icon_url} alt="" />
            ) : (
              getInitials(server.name)
            )}
          </button>
        ))}

        <button
          className="ub-rail-add"
          title="Create server"
          onClick={() => setShowCreateServer(true)}
        >
          <Plus size={22} />
        </button>

        <button
          className="ub-rail-discover"
          title="Discover servers"
          onClick={() => {
            setShowDiscover(true);
            setView('discover');
            setActiveServer(null);
          }}
        >
          <Compass size={21} />
        </button>
      </aside>

      {/* SERVER SIDEBAR */}
      {showSidebar && (
        <aside className="ub-server-sidebar">
          {activeServer ? (
            <>
              <button
                className="ub-server-namebar"
                onClick={() => setShowSettings(!showSettings)}
              >
                <span>{activeServer.name}</span>
                <ChevronDown size={17} />
              </button>

              <div className="ub-server-sidebar-actions">
                <button onClick={createInvite}>
                  <UserPlus size={15} /> Invite people
                </button>
                {can('manage_channels') && (
                  <button onClick={() => setShowCreateChannel(true)}>
                    <Plus size={15} /> Create channel
                  </button>
                )}
              </div>

              <div className="ub-channel-list">
                <div className="ub-channel-heading">
                  <span>TEXT CHANNELS</span>
                  {can('manage_channels') && (
                    <button
                      title="Add channel"
                      onClick={() => setShowCreateChannel(true)}
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>

                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    className={`ub-channel-item ${
                      activeChannel?.id === channel.id ? 'active' : ''
                    }`}
                    onClick={() => selectChannel(channel)}
                  >
                    {channel.channel_type === 'announcement' ? (
                      <Megaphone size={17} />
                    ) : (
                      <Hash size={17} />
                    )}
                    <span>{channel.name}</span>
                    {channel.is_private && <Lock size={13} />}
                  </button>
                ))}

                {!channels.length && (
                  <p className="ub-sidebar-hint">
                    No channels available.
                  </p>
                )}
              </div>

              <div className="ub-sidebar-bottom">
                <div className="ub-current-user">
                  <div className="ub-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      getInitials(displayName)
                    )}
                  </div>
                  <div className="ub-current-user-info">
                    <strong>{displayName}</strong>
                    <small>Online</small>
                  </div>
                  <button
                    title="Leave server"
                    onClick={leaveServer}
                    disabled={isOwner}
                  >
                    <LogOut size={17} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="ub-server-namebar">
                <span>UNBLINDED</span>
                <Sparkles size={17} />
              </div>

              <div className="ub-sidebar-welcome">
                <div className="ub-welcome-icon">
                  <Users size={28} />
                </div>
                <h2>Your communities.</h2>
                <p>
                  Find your people. Share ideas. Build something meaningful.
                </p>
                <button onClick={() => setShowCreateServer(true)}>
                  <Plus size={16} /> Create a server
                </button>
                <button
                  className="ub-secondary-button"
                  onClick={() => {
                    setShowDiscover(true);
                    setView('discover');
                  }}
                >
                  <Compass size={16} /> Explore servers
                </button>
              </div>

              <div className="ub-sidebar-bottom">
                <div className="ub-current-user">
                  <div className="ub-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" />
                    ) : (
                      getInitials(displayName)
                    )}
                  </div>
                  <div className="ub-current-user-info">
                    <strong>{displayName}</strong>
                    <small>Online</small>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      )}

      {/* MAIN CONTENT */}
      <main className="ub-server-main">
        <header className="ub-server-topbar">
          <button
            className="ub-icon-button"
            onClick={() => setShowSidebar(!showSidebar)}
            title="Toggle sidebar"
          >
            <Menu size={19} />
          </button>

          {activeServer && activeChannel ? (
            <div className="ub-topbar-channel">
              {activeChannel.channel_type === 'announcement' ? (
                <Megaphone size={18} />
              ) : (
                <Hash size={18} />
              )}
              <strong>{activeChannel.name}</strong>
              {activeChannel.description && (
                <span>{activeChannel.description}</span>
              )}
            </div>
          ) : (
            <div className="ub-topbar-channel">
              <Sparkles size={18} />
              <strong>
                {view === 'discover' ? 'Discover communities' : 'Your servers'}
              </strong>
            </div>
          )}

          {activeServer && (
            <div className="ub-topbar-actions">
              <button
                className="ub-icon-button"
                title="Members"
                onClick={() => setShowMembers(!showMembers)}
              >
                <Users size={19} />
              </button>
              {can('manage_channels') && (
                <button
                  className="ub-icon-button"
                  title="Server settings"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings size={19} />
                </button>
              )}
            </div>
          )}
        </header>

        {error && (
          <div className="ub-server-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}

        {notice && (
          <div className="ub-server-notice">
            <Check size={15} />
            {notice}
          </div>
        )}

        {loading && !activeServer ? (
          <div className="ub-server-loading">
            <Loader2 className="ub-spin" size={28} />
            <p>Loading your communities...</p>
          </div>
        ) : activeServer && activeChannel ? (
          <div className="ub-chat-layout">
            <section className="ub-chat-content">
              <div className="ub-message-list">
                {messages.length === 0 ? (
                  <div className="ub-chat-empty">
                    <div className="ub-chat-empty-icon">
                      <Hash size={30} />
                    </div>
                    <h2>Welcome to #{activeChannel.name}</h2>
                    <p>
                      This is the beginning of the conversation.
                      Say something worth remembering.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.author_id === userId;
                    const canManage =
                      mine || can('manage_messages');

                    const groupedReactions = Object.values(
                      (message.reactions || []).reduce((acc, reaction) => {
                        if (!acc[reaction.emoji]) {
                          acc[reaction.emoji] = {
                            emoji: reaction.emoji,
                            count: 0,
                            mine: false
                          };
                        }

                        acc[reaction.emoji].count += 1;

                        if (reaction.user_id === userId) {
                          acc[reaction.emoji].mine = true;
                        }

                        return acc;
                      }, {})
                    );

                    return (
                      <article
                        className="ub-message"
                        key={message.id}
                      >
                        <div className="ub-message-avatar">
                          {message.author?.avatar_url ? (
                            <img
                              src={message.author.avatar_url}
                              alt=""
                            />
                          ) : (
                            getInitials(getAuthorName(message))
                          )}
                        </div>

                        <div className="ub-message-body">
                          <div className="ub-message-meta">
                            <strong>{getAuthorName(message)}</strong>
                            <time>{formatTime(message.created_at)}</time>
                            {message.is_edited && (
                              <small>(edited)</small>
                            )}
                            {message.is_pinned && (
                              <span className="ub-pinned-label">
                                <Pin size={12} /> Pinned
                              </span>
                            )}
                          </div>

                          {message.reply_to && (
                            <div className="ub-reply-reference">
                              <Reply size={13} />
                              Reply to another message
                            </div>
                          )}

                          <p className="ub-message-text">
                            {message.body}
                          </p>

                          {groupedReactions.length > 0 && (
                            <div className="ub-reactions">
                              {groupedReactions.map((reaction) => (
                                <button
                                  key={reaction.emoji}
                                  className={
                                    reaction.mine ? 'mine' : ''
                                  }
                                  onClick={() =>
                                    toggleReaction(message, reaction.emoji)
                                  }
                                >
                                  {reaction.emoji}
                                  <span>{reaction.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="ub-message-tools">
                            <button
                              title="React"
                              onClick={() =>
                                setShowEmoji(
                                  showEmoji === message.id
                                    ? null
                                    : message.id
                                )
                              }
                            >
                              <Smile size={15} />
                            </button>
                            <button
                              title="Reply"
                              onClick={() => startReply(message)}
                            >
                              <Reply size={15} />
                            </button>
                            {canManage && (
                              <button
                                title="More actions"
                                onClick={() =>
                                  setMenuMessage(
                                    menuMessage === message.id
                                      ? null
                                      : message.id
                                  )
                                }
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            )}
                          </div>

                          {showEmoji === message.id && (
                            <div className="ub-emoji-picker">
                              {EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() =>
                                    toggleReaction(message, emoji)
                                  }
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          {menuMessage === message.id && (
                            <div className="ub-message-menu">
                              {mine && (
                                <button onClick={() => startEdit(message)}>
                                  <Pencil size={14} /> Edit message
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  togglePin(message);
                                  setMenuMessage(null);
                                }}
                              >
                                <Pin size={14} />
                                {message.is_pinned ? 'Unpin' : 'Pin'}
                              </button>
                              <button
                                className="danger"
                                onClick={() => {
                                  deleteMessage(message);
                                  setMenuMessage(null);
                                }}
                              >
                                <Trash2 size={14} /> Delete message
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>

              {can('send_messages') ? (
                <form className="ub-message-composer" onSubmit={sendMessage}>
                  {(replyingTo || editingMessage) && (
                    <div className="ub-composer-context">
                      <span>
                        {editingMessage
                          ? 'Editing message'
                          : `Replying to ${getAuthorName(replyingTo)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setEditingMessage(null);
                          setMessageText('');
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  <div className="ub-composer-input">
                    <input
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Message #${activeChannel.name}`}
                      maxLength={10000}
                    />
                    <button
                      type="submit"
                      disabled={!messageText.trim() || busy}
                      title="Send message"
                    >
                      {busy ? (
                        <Loader2 className="ub-spin" size={18} />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="ub-readonly-notice">
                  You don't have permission to send messages here.
                </div>
              )}
            </section>

            {showMembers && (
              <aside className="ub-member-panel">
                <div className="ub-member-heading">
                  MEMBERS — {members.length}
                </div>

                {members.map((member) => {
                  const name = getMemberName(member);

                  return (
                    <div
                      className="ub-member-row"
                      key={member.id}
                    >
                      <div className="ub-member-avatar">
                        {member.profile?.avatar_url ? (
                          <img
                            src={member.profile.avatar_url}
                            alt=""
                          />
                        ) : (
                          getInitials(name)
                        )}
                      </div>

                      <div className="ub-member-info">
                        <strong>{name}</strong>
                        <small>{member.role?.name || 'Member'}</small>
                      </div>

                      {member.user_id === activeServer.owner_id ? (
                        <Crown size={15} className="ub-owner-icon" />
                      ) : can('manage_members') &&
                        member.user_id !== userId ? (
                        <div className="ub-member-actions">
                          <button
                            title="Remove member"
                            onClick={() => removeMember(member)}
                          >
                            <User size={14} />
                          </button>
                          <button
                            title="Ban member"
                 
