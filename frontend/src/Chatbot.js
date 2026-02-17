import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './Chatbot.css';

const API_BASE_URL = 'http://localhost:5001';

function Chatbot({ selectedFile }) {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      sender: 'bot', 
      text: 'Hello! I am your well log data assistant. Ask me about curves, depth, or hydrocarbon zones.' 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    if (!selectedFile) {
      setMessages([...messages, 
        { id: messages.length + 1, sender: 'user', text: input },
        { id: messages.length + 2, sender: 'bot', text: 'Please select a file first from the dropdown menu.' }
      ]);
      setInput('');
      return;
    }

    const userMessage = { id: messages.length + 1, sender: 'user', text: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        message: input,
        fileId: selectedFile
      });
      
      const botMessage = { 
        id: messages.length + 2, 
        sender: 'bot', 
        text: response.data.response 
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { 
        id: messages.length + 2, 
        sender: 'bot', 
        text: 'Error: Unable to process your request. Please try again.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  const suggestions = [
    "What curves are available?",
    "Find hydrocarbon zones",
    "Tell me about HC5",
    "What is the depth range?",
    "Show me anomalies"
  ];

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h3>Well Log Assistant</h3>
        <span className="chatbot-status">{selectedFile ? 'Connected' : 'Disconnected'}</span>
      </div>
      
      <div className="chatbot-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-bubble">{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="message bot">
            <div className="message-bubble typing">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chatbot-suggestions">
        {suggestions.map((sugg, i) => (
          <button key={i} className="suggestion-chip" onClick={() => setInput(sugg)}>
            {sugg}
          </button>
        ))}
      </div>
      
      <div className="chatbot-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about your well data..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chatbot;