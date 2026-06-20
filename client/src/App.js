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
      setFileName('');
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

  // Get data from another address
  const handleGetData = async () => {
    if (!otherAddress.trim() || !contract) return;
    await loadFiles(otherAddress);
  };

  // Shorten address
  const shorten = (addr) => addr.slice(0, 6) + '...' + addr.slice(-4);

  // Not connected
  if (!account) {
    return (
      <div>
        <div className="navbar">
          <h2>D-Drive</h2>
        </div>
        <div className="connect-page">
          <h1>Decentralized Drive</h1>
          <p>Upload and share files on blockchain</p>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  // Connected
  return (
    <div>
      <div className="navbar">
        <h2>D-Drive</h2>
        <span className="account">{shorten(account)}</span>
      </div>

      <div className="container">
        {/* Upload */}
        <div className="upload-box">
          <p>Choose a file to upload to IPFS</p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
          />
          <br />
          <button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {/* Share Access */}
        <div className="share-section" style={{ borderTop: '4px solid #e94560' }}>
          <div style={{ width: '100%', marginBottom: '10px', fontWeight: 'bold' }}>Give Access</div>
          <input
            placeholder="Enter address to share your drive"
            value={shareAddress}
            onChange={(e) => setShareAddress(e.target.value)}
          />
          <button onClick={handleShare} style={{ background: '#e94560' }}>Share</button>
        </div>

        {/* Get other user's data */}
        <div className="share-section">
          <div style={{ width: '100%', marginBottom: '10px', fontWeight: 'bold' }}>View Shared Drive</div>
          <input
            placeholder="Enter address to get data"
            value={otherAddress}
            onChange={(e) => setOtherAddress(e.target.value)}
          />
          <button onClick={handleGetData}>Get Data</button>
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
