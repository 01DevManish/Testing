-- Database Schema for Eurus ERP Sync

CREATE DATABASE IF NOT EXISTS eurus_erp;
USE eurus_erp;

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    collection VARCHAR(100),
    itemGroup VARCHAR(100),
    stock INT DEFAULT 0,
    price DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(50),
    updatedAt BIGINT
);

-- 2. Dispatches (Orders) Table
CREATE TABLE IF NOT EXISTS dispatches (
    id VARCHAR(100) PRIMARY KEY,
    partyName VARCHAR(255),
    transporterName VARCHAR(255),
    bails INT DEFAULT 0,
    status VARCHAR(50),
    paymentStatus VARCHAR(50),
    dispatchDate VARCHAR(100),
    remarks TEXT,
    createdAt BIGINT,
    updatedAt BIGINT
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50),
    permissions TEXT,
    dispatchPin VARCHAR(10),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    assignedTo VARCHAR(100),
    assignedToName VARCHAR(255),
    assignedToRole VARCHAR(50),
    priority VARCHAR(20),
    status VARCHAR(50),
    createdAt BIGINT,
    expiresAt BIGINT,
    completedAt BIGINT,
    createdBy VARCHAR(100),
    createdByName VARCHAR(255),
    attachments TEXT, -- Store as JSON string
    updatedAt BIGINT DEFAULT (UNIX_TIMESTAMP() * 1000)
);

-- 4. Sync Log (Optional)
CREATE TABLE IF NOT EXISTS sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(50),
    tbl VARCHAR(50),
    record_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
