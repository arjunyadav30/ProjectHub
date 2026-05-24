import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { chatAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { DashboardLayout } from '../../components/common/Layout';
import { Button, Input, Modal } from '../../components/common';
import { Send, Trash2, Users, MessageSquare, Plus, Search, Video } from 'lucide-react';
import toast from 'react-hot-toast';

const SOCKET_URL = window.location.origin;
const QUICK_EMOJIS = ['😀', '🔥', '👍', '🎯', '✅', '🚀'];

const ChatPage = () => {
  const { type, id } = useParams(); // type: 'group'|'direct', id: teamId|userId
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [contactName, setContactName] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingEmitTimerRef = useRef(null);
  const typingClearTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const previewMessage = (msg) => {
    if (!msg) return '';
    const text = msg.content || (msg.image_url ? 'Sent an image' : '');
    return text.length > 42 ? `${text.slice(0, 39)}...` : text;
  };

  const sortThreads = (items) => [...items].sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.name || '').localeCompare(b.name || '');
  });

  const bumpThread = useCallback((threadType, threadId, msg, { incrementUnread = false } = {}) => {
    setContacts(prev => sortThreads(prev.map(thread => {
      if (thread.thread_type !== threadType || thread._id?.toString() !== threadId?.toString()) return thread;
      const unread = incrementUnread ? (thread.unread_count || 0) + 1 : 0;
      return {
        ...thread,
        last_message: previewMessage(msg),
        last_message_at: msg.created_at || new Date().toISOString(),
        unread_count: unread,
      };
    })));
  }, []);

  const resolveThreadFromMessage = useCallback((msg) => {
    if (msg.team_id) {
      return { threadType: 'group', threadId: String(msg.team_id) };
    }
    if (msg.room_id) {
      const parts = String(msg.room_id).split('_');
      const otherId = parts.find(p => p !== user._id?.toString());
      return { threadType: 'direct', threadId: otherId || parts[0] };
    }
    return null;
  }, [user._id]);

  const loadContacts = useCallback(() => {
    chatAPI.getContacts()
      .then(res => setContacts(sortThreads(res.data.data || [])))
      .catch(() => toast.error('Failed to load chats'));
  }, []);

  useRefetchOnFocus(loadContacts, { pollMs: 20000 });

  const clearUnread = useCallback((threadType, threadId) => {
    setContacts(prev => prev.map(thread => (
      thread.thread_type === threadType && thread._id?.toString() === threadId?.toString()
        ? { ...thread, unread_count: 0 }
        : thread
    )));
  }, []);

  useEffect(() => {
    const query = searchText.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      chatAPI.searchUsers(query)
        .then(res => setSearchResults(res.data.data || []))
        .catch(() => toast.error('Search failed'))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Update contact name when contacts or id changes
  useEffect(() => {
    if (type === 'direct' && id && contacts.length > 0) {
      const c = contacts.find(c => c.thread_type === 'direct' && c._id === id);
      setContactName(c?.name || 'Direct Chat');
    } else if (type === 'group') {
      const c = contacts.find(c => c.thread_type === 'group' && c._id === id);
      setContactName(c?.name || 'Team Group Chat');
    }
  }, [contacts, id, type]);

  // Connect socket when type+id are valid
  useEffect(() => {
    if (!type || !id) return;

    const namespace = type === 'group' ? '/group-chat' : '/direct-chat';
    const socket = io(SOCKET_URL + namespace, {
      withCredentials: true,
      auth: { token: localStorage.getItem('accessToken') },
    });
    socketRef.current = socket;

    const roomId = type === 'group' ? id : [user._id, id].sort().join('_');
    socket.emit('join_room', roomId);

    socket.on('receive_message', (msg) => {
      const resolved = resolveThreadFromMessage(msg) || { threadType: type, threadId: id };
      const senderId = msg.sender_id?._id || msg.sender_id;
      const isFromMe = senderId === user._id || senderId?.toString() === user._id?.toString();
      const isCurrentChat =
        resolved.threadType === type &&
        resolved.threadId?.toString() === id?.toString();

      if (isCurrentChat) {
        if (!isFromMe) setTypingUser('');
        setMessages(prev => {
          if (prev.find(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        bumpThread(resolved.threadType, resolved.threadId, msg);
      } else if (!isFromMe) {
        bumpThread(resolved.threadType, resolved.threadId, msg, { incrementUnread: true });
      }
    });

    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev =>
        prev.map(m => m._id === messageId ? { ...m, is_deleted: true, content: '' } : m)
      );
    });

    const clearTypingIndicator = () => {
      clearTimeout(typingClearTimerRef.current);
      setTypingUser('');
    };

    socket.on('typing', ({ userName, userId }) => {
      if (userId && String(userId) === String(user._id)) return;
      setTypingUser(userName || '');
      clearTimeout(typingClearTimerRef.current);
      typingClearTimerRef.current = setTimeout(clearTypingIndicator, 3000);
    });

    socket.on('stop_typing', ({ userId } = {}) => {
      if (userId && String(userId) === String(user._id)) return;
      clearTypingIndicator();
    });

    return () => {
      clearTimeout(typingClearTimerRef.current);
      clearTimeout(typingEmitTimerRef.current);
      clearTimeout(typingTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [type, id, user._id, bumpThread, resolveThreadFromMessage]);

  // Load messages when type+id change
  useEffect(() => {
    if (!type || !id) return;
    setMessages([]);
    setLoading(true);

    const req = type === 'group'
      ? chatAPI.getGroupMessages(id)
      : chatAPI.getDirectMessages(id);

    req.then(res => setMessages(res.data.data || []))
      .then(() => chatAPI.markRead(type, id))
      .then(() => clearUnread(type, id))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load chat');
        navigate('/chat');
      })
      .finally(() => setLoading(false));
  }, [type, id, clearUnread, navigate]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const emitStopTyping = useCallback(() => {
    if (!id || !type) return;
    clearTimeout(typingTimerRef.current);
    clearTimeout(typingEmitTimerRef.current);
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    const roomId = type === 'group' ? id : [user._id, id].sort().join('_');
    socketRef.current?.emit('stop_typing', { team_id: id, room_id: roomId });
  }, [type, id, user._id]);

  const handleSend = async () => {
    if ((!text.trim() && !fileUrl.trim()) || !type || !id) return;
    const payload = {
      content: text.trim(),
      file_url: fileUrl.trim(),
      file_name: fileName.trim(),
      file_type: fileUrl ? 'link' : '',
    };
    setText('');
    setFileUrl('');
    setFileName('');
    emitStopTyping();

    try {
      const res = type === 'group'
        ? await chatAPI.sendGroupMessage(id, payload)
        : await chatAPI.sendDirectMessage(id, payload);

      const newMsg = res.data.data;
      const roomId = type === 'group' ? id : [user._id, id].sort().join('_');
      socketRef.current?.emit('send_message', {
        ...newMsg,
        team_id: type === 'group' ? id : undefined,
        room_id: type === 'direct' ? roomId : undefined,
      });

      setMessages(prev => prev.find(m => m._id === newMsg._id) ? prev : [...prev, newMsg]);
      bumpThread(type, id, newMsg);
      loadContacts();
    } catch { toast.error('Failed to send message'); }
  };

  const handleDelete = async (msgId) => {
    try {
      await chatAPI.deleteMessage(msgId);
      const roomId = type === 'group' ? id : [user._id, id].sort().join('_');
      socketRef.current?.emit('delete_message', { messageId: msgId, team_id: id, room_id: roomId });
      setMessages(prev =>
        prev.map(m => m._id === msgId ? { ...m, is_deleted: true, content: '' } : m)
      );
      toast.success('Message deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleTyping = (value) => {
    if (!id || !type) return;
    const roomId = type === 'group' ? id : [user._id, id].sort().join('_');
    const payload = { userName: user.name, userId: user._id, team_id: id, room_id: roomId };

    if (!value.trim()) {
      emitStopTyping();
      return;
    }

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(emitStopTyping, 2000);

    if (isTypingRef.current) return;

    clearTimeout(typingEmitTimerRef.current);
    typingEmitTimerRef.current = setTimeout(() => {
      isTypingRef.current = true;
      socketRef.current?.emit('typing', payload);
    }, 400);
  };

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatThreadTime = (date) => {
    if (!date) return '';
    const value = new Date(date);
    const today = new Date();
    if (value.toDateString() === today.toDateString()) return formatTime(value);
    return value.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const hasChat = type && id;
  const appendEmoji = (emoji) => setText((prev) => `${prev}${emoji}`);
  const openVideoCall = () => {
    if (!hasChat) return;
    const room = type === 'group'
      ? `projecthub-team-${id}`
      : `projecthub-dm-${[user._id, id].sort().join('-')}`;
    window.open(`https://meet.jit.si/${room}`, '_blank', 'noopener,noreferrer');
  };

  const startDirectChat = (targetUser) => {
    setContacts(prev => {
      const exists = prev.some(thread => thread.thread_type === 'direct' && thread._id === targetUser._id);
      if (exists) return prev;
      return sortThreads([
        ...prev,
        {
          _id: targetUser._id,
          thread_type: 'direct',
          name: targetUser.name,
          role: targetUser.role,
          profile_image: targetUser.profile_image,
          email: targetUser.email,
          last_message: targetUser.role,
          last_message_at: null,
          unread_count: 0,
        },
      ]);
    });
    setShowNewChat(false);
    setSearchText('');
    navigate(`/chat/direct/${targetUser._id}`);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4">

        {/* Chats sidebar */}
        <div className="w-64 flex-shrink-0 card overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">Chats</p>
                <p className="text-xs text-gray-500 mt-0.5">Recent conversations first</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowNewChat(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {contacts.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No chats found</p>
            )}
            {contacts.map(contact => (
              <button
                key={`${contact.thread_type}-${contact._id}`}
                onClick={() => navigate(`/chat/${contact.thread_type}/${contact._id}`)}
                className={`w-full flex items-start gap-2 p-2.5 rounded-xl text-left transition-colors ${
                  type === contact.thread_type && id === contact._id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                  {contact.thread_type === 'group'
                    ? <Users className="w-4 h-4" />
                    : contact.profile_image
                    ? <img src={contact.profile_image} className="w-full h-full object-cover" alt="" />
                    : contact.name?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {contact.unread_count > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {contact.unread_count > 9 ? '9+' : contact.unread_count}
                        </span>
                      )}
                      {contact.last_message_at && (
                        <span className="text-[10px] text-gray-400">{formatThreadTime(contact.last_message_at)}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {contact.last_message || (contact.thread_type === 'group' ? 'Team group chat' : contact.role)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 card overflow-hidden flex flex-col min-w-0">

          {!hasChat ? (
            /* No conversation selected */
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a chat to continue</p>
                <p className="text-sm mt-1">Use New Chat to message someone new</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  {type === 'group'
                    ? <Users className="w-5 h-5 text-blue-600" />
                    : <MessageSquare className="w-5 h-5 text-blue-600" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{contactName}</p>
                  <p className="text-xs text-gray-500">{type === 'group' ? 'Team group chat' : 'Direct message'}</p>
                </div>
                <button
                  onClick={openVideoCall}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
                >
                  <Video className="w-3.5 h-3.5" /> Video Call
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                  </div>
                ) : messages.map((msg, i) => {
                  const senderId = msg.sender_id?._id || msg.sender_id;
                  const isMe = senderId === user._id || senderId?.toString() === user._id?.toString();

                  return (
                    <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0 self-end overflow-hidden">
                          {msg.sender_id?.profile_image
                            ? <img src={msg.sender_id.profile_image} className="w-full h-full object-cover" alt="" />
                            : msg.sender_id?.name?.[0] || '?'}
                        </div>
                      )}
                      <div className={`group max-w-xs lg:max-w-md flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && (
                          <p className="text-xs text-gray-500 mb-0.5 ml-1">{msg.sender_id?.name}</p>
                        )}
                        <div className={`relative px-4 py-2.5 rounded-2xl text-sm ${
                          msg.is_deleted
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 italic'
                            : isMe
                              ? 'bg-blue-600 text-white rounded-br-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                        }`}>
                          {msg.is_deleted ? 'Message deleted' : msg.content}
                          {msg.image_url && !msg.is_deleted && (
                            <img src={msg.image_url} alt="attachment"
                              className="mt-1 rounded-xl max-w-full" />
                          )}
                          {msg.file_url && !msg.is_deleted && (
                            <a
                              href={msg.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`mt-1 block underline ${isMe ? 'text-blue-100' : 'text-blue-600 dark:text-blue-300'}`}
                            >
                              {msg.file_name || 'Open attachment'}
                            </a>
                          )}
                          {isMe && !msg.is_deleted && (
                            <button
                              onClick={() => handleDelete(msg._id)}
                              className="absolute -top-2 -left-8 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 hover:bg-red-200 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className={`text-xs text-gray-400 mt-0.5 ${isMe ? 'text-right' : 'text-left'} ml-1`}>
                          {formatTime(msg.created_at)} {type === 'direct' && isMe ? (msg.read_by?.length > 1 ? '• Seen' : '• Sent') : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {typingUser && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                    <span>{typingUser} is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex flex-wrap gap-1 mb-2">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => appendEmoji(emoji)}
                      className="px-2 py-1 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    className="input flex-1"
                    placeholder="Attachment URL (optional)"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                  />
                  <input
                    className="input flex-1"
                    placeholder="File name"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Type a message..."
                    value={text}
                    onChange={e => { setText(e.target.value); handleTyping(e.target.value); }}
                    onBlur={() => emitStopTyping()}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() && !fileUrl.trim()}
                    className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={showNewChat} onClose={() => setShowNewChat(false)} title="New Chat">
        <div className="space-y-3">
          <Input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search by name, email, or role"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto space-y-2">
            {searchText.trim().length < 2 ? (
              <div className="text-center py-8 text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Type at least 2 characters</p>
              </div>
            ) : searching ? (
              <p className="text-sm text-gray-400 text-center py-6">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No users found</p>
            ) : searchResults.map(result => (
              <button
                key={result._id}
                onClick={() => startDirectChat(result)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-sm overflow-hidden">
                  {result.profile_image ? <img src={result.profile_image} className="w-full h-full object-cover" alt="" /> : result.name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{result.name}</p>
                  <p className="text-xs text-gray-500 truncate">{result.role} - {result.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default ChatPage;
