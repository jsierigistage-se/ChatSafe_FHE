# ChatSafe_FHE: A Privacy-Preserving Secure Messenger

ChatSafe_FHE is a pioneering secure messaging application that guarantees the privacy of your conversations through the power of Zama's Fully Homomorphic Encryption (FHE) technology. By encrypting your messages end-to-end, ChatSafe_FHE ensures your data is always protected, even during processing. 

## The Problem

In the age of digital communication, protecting personal information is paramount. Traditional messaging apps often transmit messages in cleartext, exposing users to privacy risks, surveillance, and data breaches. This cleartext data is vulnerable to interception, allowing attackers to access sensitive information without any barriers. The need for a secure messaging solution that keeps conversations private and untraceable is evident.

## The Zama FHE Solution

ChatSafe_FHE utilizes Zama's innovative FHE technology to solve these privacy issues. With Fully Homomorphic Encryption, computation can be performed on encrypted data without the need for decryption. This means that even if your messages are processed by the server, they remain encrypted, and sensitive information never leaves your control. Using Zama's `fhevm`, we facilitate secure, efficient processing of encrypted messages, ensuring that your conversations are shielded from prying eyes.

## Key Features

- 🔒 **End-to-End Encryption**: Every message is encrypted from sender to recipient, ensuring privacy during transmission.
- 📜 **Homomorphic Keyword Filtering**: Automatically filter unwanted messages such as spam without decrypting content.
- 🛡️ **Secure Communication**: Safeguard your conversations against hacking and surveillance.
- ⚖️ **Anti-Censorship Features**: The app is designed to resist attempts at censorship, allowing free communication.
- ⚙️ **User-Friendly Interface**: Easy-to-navigate chat list and settings, making privacy simple.

## Technical Architecture & Stack

ChatSafe_FHE is built upon the following technology stack:

- **Core Privacy Engine**: Zama's `fhevm`
- **Programming Languages**: Rust for backend logic, JavaScript for the frontend
- **UI Framework**: React for a responsive user interface
- **Database**: Encrypted storage solution for maintaining message integrity

## Smart Contract / Core Logic

Below is a sample pseudo-code snippet illustrating how to process messages while maintaining encryption using Zama's `fhevm`. This example demonstrates the core logic for sending and receiving messages securely.

```solidity
pragma solidity ^0.8.0;

contract ChatSafe {
    struct EncryptedMessage {
        uint64 id;
        bytes32 content; // Encrypted content
        uint64 timestamp;
    }

    mapping(uint64 => EncryptedMessage) public messages;

    function sendMessage(uint64 id, bytes32 encryptedContent) public {
        messages[id] = EncryptedMessage(id, encryptedContent, block.timestamp);
    }

    function readMessage(uint64 id) public view returns (EncryptedMessage memory) {
        return messages[id];
    }
}
```

## Directory Structure

Here’s the directory structure for the ChatSafe_FHE project:

```
ChatSafe_FHE/
├── contracts/
│   └── ChatSafe.sol
├── src/
│   ├── components/
│   │   └── ChatList.jsx
│   │   └── Settings.jsx
│   ├── App.js
│   └── main.js
├── server/
│   ├── encryption.rs
│   └── main.rs
├── .env
└── README.md
```

## Installation & Setup

To get started with ChatSafe_FHE, follow these steps:

### Prerequisites

Ensure you have the following installed on your machine:

- Node.js (for the frontend)
- Rust (for the backend)
- npm or yarn (for package management)

### Installation Steps

1. Clone the repository to your local machine (omit the git clone command).
2. Navigate to the `ChatSafe_FHE` directory.
3. Install the necessary dependencies:

   For the frontend:
   ```bash
   npm install
   ```

   For the backend:
   ```bash
   cargo build
   ```

4. Install the Zama library to enable FHE functionalities:

   ```bash
   npm install fhevm
   ```

## Build & Run

To compile and run the ChatSafe_FHE project:

1. Start the backend server:
   ```bash
   cargo run
   ```

2. In a separate terminal, start the frontend application:
   ```bash
   npm start
   ```

3. Your secure messaging app will now be up and running, ready for you to send encrypted messages!

## Acknowledgements

We would like to express our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their innovative work in the field of fully homomorphic encryption enables us to build applications that prioritize user privacy and data security.

---

Enjoy secure messaging with ChatSafe_FHE, where your conversations remain confidential!

