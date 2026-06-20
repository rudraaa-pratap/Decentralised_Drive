import { useState, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import Upload from './Upload.json';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [otherAddress, setOtherAddress] = useState('');
  const [shareAddress, setShareAddress] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  
  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  
  const PINATA_API_KEY = "34dbbf4bfc6fda774bd1";
  const PINATA_SECRET_KEY = "ad114dad1ddb2842d50f54e2215593f8af13a302d9264cf5351ac23d4c39e309";

  
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          Upload.abi,
          signer
        );

        setAccount(address);
        setContract(contract);

        // Listen for account changes
        window.ethereum.on("accountsChanged", () => {
          window.location.reload();
        });
      } catch (error) {
        console.error("Connection error:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Load files from contract
  const loadFiles = async (address) => {
    if (!contract) return;
    try {
      const data = await contract.display(address);
      const imageList = data.map((url, index) => ({
        id: index,
        url: url,
        name: `File ${index + 1}`,
        isImage: true,
      }));
      setFiles(imageList);
    } catch (error) {
      console.error("Error loading files:", error);
      alert("You don't have access or no files found");
    }
  };

  // Load own files when connected
  useEffect(() => {
    if (contract && account) {
      loadFiles(account);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, account]);

  // Handle file pick
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
    }
  };

  // Upload file to Pinata IPFS and store hash on contract
  const handleUpload = async () => {
    if (!file || !contract) return;

    setUploading(true);
    try {
      // Upload to Pinata
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxBodyLength: "Infinity",
          headers: {
            "Content-Type": "multipart/form-data",
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_KEY,
          },
        }
      );

      const ipfsHash = res.data.IpfsHash;
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

      // Store URL on smart contract
      const tx = await contract.add(account, ipfsUrl);
      await tx.wait();

      // Refresh files
      await loadFiles(account);

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert("File uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed: " + error.message);
    }
    setUploading(false);
  };

  // Share access with another address
  const handleShare = async () => {
    if (!shareAddress.trim() || !contract) return;
    try {
      const tx = await contract.allow(shareAddress);
      await tx.wait();
      alert("Access granted successfully to " + shareAddress);
      setShareAddress('');
    } catch (error) {
      console.error("Share error:", error);
      alert("Failed to share access: " + error.message);
    }
  };

  // Not connected
  if (!account) {
    return (
      <div className="connect-page">
        <h1>Decentralized Drive</h1>
        <p>Upload and share files securely on the blockchain</p>
        <button className="connect-btn-large" onClick={connectWallet}>
          Connect Wallet
        </button>
      </div>
    );
  }

  // Connected
  return (
    <div className="App">
      <nav className="navbar">
        <h2>D-Drive</h2>
        <div className="account">
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not connected"}
        </div>
      </nav>

      <div className="container">
        
        {/* Upload Section */}
        <div className="section-card upload-area">
          <h3 className="section-title">Upload File</h3>
          <p>Choose a file to securely upload to IPFS</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            disabled={uploading} 
          />
          <br/>
          <button className="btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload to IPFS"}
          </button>
        </div>

        {/* Share Section */}
        <div className="section-card">
          <h3 className="section-title">Share Access</h3>
          <div className="input-group">
            <input 
              type="text" 
              className="input-field"
              placeholder="Enter Ethereum address to grant access" 
              value={shareAddress}
              onChange={(e) => setShareAddress(e.target.value)}
            />
            <button className="btn-primary" onClick={handleShare}>Share</button>
          </div>
        </div>

        {/* Get Data Section */}
        <div className="section-card">
          <h3 className="section-title">View Shared Drive</h3>
          <div className="input-group">
            <input 
              type="text" 
              className="input-field"
              placeholder="Enter owner's address to view their files" 
              value={otherAddress}
              onChange={(e) => setOtherAddress(e.target.value)}
            />
            <button className="btn-primary" onClick={() => loadFiles(otherAddress)}>View Files</button>
          </div>
        </div>

        {/* Files */}
        <h3 className="files-heading">Your Images</h3>

        {files.length === 0 ? (
          <div className="empty">No files uploaded yet</div>
        ) : (
          <div className="image-grid">
            {files.map((f) => (
              <div key={f.id} className="image-card">
                <a href={f.url} target="_blank" rel="noreferrer">
                  <img src={f.url} alt={f.name} />
                </a>
                <div className="name">{f.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
