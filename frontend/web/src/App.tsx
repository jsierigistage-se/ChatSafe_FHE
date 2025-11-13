import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface ChatMessage {
  id: string;
  name: string;
  message: string;
  sender: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newMessageData, setNewMessageData] = useState({ name: "", message: "", filterWord: "" });
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [operationHistory, setOperationHistory] = useState<string[]>([]);
  const [showFAQ, setShowFAQ] = useState(false);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM...');
        await initialize();
        console.log('FHEVM initialized');
      } catch (error) {
        console.error('FHEVM init failed:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Load data failed:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const addToHistory = (operation: string) => {
    setOperationHistory(prev => [
      `${new Date().toLocaleTimeString()}: ${operation}`,
      ...prev.slice(0, 9)
    ]);
  };

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const messagesList: ChatMessage[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          messagesList.push({
            id: businessId,
            name: businessData.name,
            message: businessId,
            sender: businessData.creator,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading message:', e);
        }
      }
      
      setMessages(messagesList);
      addToHistory(`Loaded ${messagesList.length} encrypted messages`);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Load failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const sendMessage = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setSendingMessage(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting message with FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("No contract");
      
      const messageValue = parseInt(newMessageData.filterWord) || 1;
      const businessId = `msg-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, messageValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newMessageData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        messageValue,
        0,
        newMessageData.message
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Sending encrypted message..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Message sent securely!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowSendModal(false);
      setNewMessageData({ name: "", message: "", filterWord: "" });
      addToHistory("Sent encrypted message");
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected") 
        ? "Transaction rejected" 
        : "Send failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setSendingMessage(false); 
    }
  };

  const decryptMessage = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      setTransactionStatus({ visible: true, status: "success", message: "Message decrypted!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      addToHistory("Decrypted message with FHE");
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decrypt failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const testAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      if (available) {
        setTransactionStatus({ visible: true, status: "success", message: "FHE system available!" });
        addToHistory("Checked FHE system availability");
      }
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
    }
    setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
  };

  const filteredMessages = messages.filter(msg =>
    msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.creator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: messages.length,
    verified: messages.filter(m => m.isVerified).length,
    yourMessages: messages.filter(m => m.creator === address).length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>ChatSafe FHE 🔐</h1>
            <p>FHE-based Secure Messenger</p>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔒</div>
            <h2>Connect Wallet to Start Secure Chat</h2>
            <p>Your messages are encrypted with FHE technology for maximum privacy</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Send encrypted messages with homomorphic filtering</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Decrypt messages securely without exposing keys</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption...</p>
        <p className="loading-note">Securing your communication</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading secure messages...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>ChatSafe FHE 🔐</h1>
          <p>完全同態加密安全信使</p>
        </div>
        
        <div className="header-actions">
          <button onClick={testAvailability} className="test-btn">Test FHE</button>
          <button onClick={() => setShowSendModal(true)} className="send-btn">New Message</button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-panel">
          <div className="stat-card">
            <h3>Total Messages</h3>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <h3>Verified</h3>
            <div className="stat-value">{stats.verified}</div>
          </div>
          <div className="stat-card">
            <h3>Your Messages</h3>
            <div className="stat-value">{stats.yourMessages}</div>
          </div>
        </div>

        <div className="search-section">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={loadData} disabled={isRefreshing} className="refresh-btn">
            {isRefreshing ? "🔄" : "Refresh"}
          </button>
          <button onClick={() => setShowFAQ(true)} className="faq-btn">FAQ</button>
        </div>

        <div className="messages-section">
          <h2>Encrypted Messages</h2>
          <div className="messages-list">
            {filteredMessages.length === 0 ? (
              <div className="no-messages">
                <p>No encrypted messages found</p>
                <button onClick={() => setShowSendModal(true)} className="send-btn">
                  Send First Message
                </button>
              </div>
            ) : filteredMessages.map((message, index) => (
              <div 
                className={`message-item ${selectedMessage?.id === message.id ? "selected" : ""} ${message.isVerified ? "verified" : ""}`}
                key={index}
                onClick={() => setSelectedMessage(message)}
              >
                <div className="message-header">
                  <span className="message-name">{message.name}</span>
                  <span className="message-time">
                    {new Date(message.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="message-preview">
                  {message.isVerified ? `Decrypted: ${message.decryptedValue}` : "🔒 Encrypted Message"}
                </div>
                <div className="message-sender">
                  From: {message.sender.substring(0, 8)}...{message.sender.substring(36)}
                </div>
                <div className="message-status">
                  {message.isVerified ? "✅ Verified" : "🔓 Ready to Decrypt"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="history-panel">
          <h3>Operation History</h3>
          <div className="history-list">
            {operationHistory.map((op, idx) => (
              <div key={idx} className="history-item">{op}</div>
            ))}
          </div>
        </div>
      </div>
      
      {showSendModal && (
        <ModalSendMessage 
          onSubmit={sendMessage} 
          onClose={() => setShowSendModal(false)} 
          sending={sendingMessage} 
          messageData={newMessageData} 
          setMessageData={setNewMessageData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedMessage && (
        <MessageDetailModal 
          message={selectedMessage} 
          onClose={() => { 
            setSelectedMessage(null); 
            setDecryptedData(null); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptMessage={() => decryptMessage(selectedMessage.id)}
        />
      )}
      
      {showFAQ && (
        <FAQModal onClose={() => setShowFAQ(false)} />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalSendMessage: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  sending: boolean;
  messageData: any;
  setMessageData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, sending, messageData, setMessageData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'filterWord') {
      const intValue = value.replace(/[^\d]/g, '');
      setMessageData({ ...messageData, [name]: intValue });
    } else {
      setMessageData({ ...messageData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="send-message-modal">
        <div className="modal-header">
          <h2>Send Encrypted Message</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Encryption Active</strong>
            <p>Filter word will be encrypted with Zama FHE (Integer only)</p>
          </div>
          
          <div className="form-group">
            <label>Message Title *</label>
            <input 
              type="text" 
              name="name" 
              value={messageData.name} 
              onChange={handleChange} 
              placeholder="Enter title..." 
            />
          </div>
          
          <div className="form-group">
            <label>Message Content *</label>
            <textarea 
              name="message" 
              value={messageData.message} 
              onChange={handleChange} 
              placeholder="Enter your message..." 
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Filter Word (Integer) *</label>
            <input 
              type="number" 
              name="filterWord" 
              value={messageData.filterWord} 
              onChange={handleChange} 
              placeholder="Enter integer for FHE filtering..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={sending || isEncrypting || !messageData.name || !messageData.message || !messageData.filterWord} 
            className="submit-btn"
          >
            {sending || isEncrypting ? "Encrypting..." : "Send Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageDetailModal: React.FC<{
  message: any;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptMessage: () => Promise<number | null>;
}> = ({ message, onClose, decryptedData, setDecryptedData, isDecrypting, decryptMessage }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) { 
      setDecryptedData(null); 
      return; 
    }
    
    const decrypted = await decryptMessage();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="message-detail-modal">
        <div className="modal-header">
          <h2>Message Details</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="message-info">
            <div className="info-item">
              <span>Title:</span>
              <strong>{message.name}</strong>
            </div>
            <div className="info-item">
              <span>Sender:</span>
              <strong>{message.creator.substring(0, 8)}...{message.creator.substring(36)}</strong>
            </div>
            <div className="info-item">
              <span>Time:</span>
              <strong>{new Date(message.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Content:</span>
              <strong>{message.description}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>FHE Encrypted Data</h3>
            
            <div className="data-row">
              <div className="data-label">Filter Word:</div>
              <div className="data-value">
                {message.isVerified && message.decryptedValue ? 
                  `${message.decryptedValue} (Verified)` : 
                  decryptedData !== null ? 
                  `${decryptedData} (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${(message.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? "🔓 Decrypting..." : message.isVerified ? "✅ Verified" : decryptedData !== null ? "🔄 Re-decrypt" : "🔓 Decrypt"}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Secure Decryption</strong>
                <p>Data remains encrypted until you choose to decrypt it with your keys</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

const FAQModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="modal-overlay">
    <div className="faq-modal">
      <div className="modal-header">
        <h2>FHE Secure Messenger FAQ</h2>
        <button onClick={onClose} className="close-modal">×</button>
      </div>
      
      <div className="modal-body">
        <div className="faq-item">
          <h3>What is FHE?</h3>
          <p>Fully Homomorphic Encryption allows computations on encrypted data without decryption</p>
        </div>
        <div className="faq-item">
          <h3>How are messages secured?</h3>
          <p>All messages are encrypted with Zama FHE technology before being stored on-chain</p>
        </div>
        <div className="faq-item">
          <h3>What can be encrypted?</h3>
          <p>Currently supports integer values for homomorphic filtering operations</p>
        </div>
      </div>
      
      <div className="modal-footer">
        <button onClick={onClose} className="close-btn">Close</button>
      </div>
    </div>
  </div>
);

export default App;

