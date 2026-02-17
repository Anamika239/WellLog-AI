# WellLog AI - Well Log Data Analyzer

A full-stack web application for analyzing LAS (Log ASCII Standard) well log files with interactive visualization and AI-powered interpretation.

## 🎯 Overview

WellLog AI is a professional tool designed for geologists, petroleum engineers, and data scientists to analyze well log data. It provides an intuitive interface for uploading LAS files, visualizing well curves, and extracting insights using statistical analysis.

## ✨ Features

### Core Features
- **📤 LAS File Upload** - Upload well log files up to 1GB in size
- **📊 Interactive Visualization** - Plot multiple well curves against depth
- **🤖 AI-Powered Interpretation** - Statistical analysis with anomaly detection
- **💬 Smart Chatbot Assistant** - Query your data using natural language
- **📈 Trend Analysis** - Detect increasing/decreasing patterns in data
- **🔍 Anomaly Detection** - Identify statistically significant outliers

### Data Analysis Capabilities
- Hydrocarbon zone detection
- Curve statistics (avg, min, max, std deviation)
- Peak detection and analysis
- Depth range exploration
- Multi-curve comparison

## 🛠️ Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **SQLite3** - Embedded database
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### Frontend
- **React.js** - UI library
- **Recharts** - Charting library
- **React-Select** - Multi-select dropdowns
- **Axios** - HTTP client
- **CSS3** - Styling with modern features

## 📁 Project Structure

<img width="474" height="505" alt="Screenshot 2026-02-17 at 21 58 22" src="https://github.com/user-attachments/assets/472628af-ffe7-4e93-b810-8c91ce45e42d" />



## 💻 Installation

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **Git** (for cloning)


git clone https://github.com/Anamika239/WellLog-AI.git
cd WellLog-AI

cd backend
npm install

cd frontend
npm install
___________________________________________________________________________________________________________________________________________________________________________
cd backend
node server.js

<img width="451" height="194" alt="Screenshot 2026-02-17 at 22 00 43" src="https://github.com/user-attachments/assets/4f350d8b-3c22-4d95-aeb5-d274e17414fc" />


cd frontend
npm start

The frontend will automatically open at http://localhost:3000

______________________________________________________________________________________________________________________________________________________________________________

#!/bin/bash
echo "Starting WellLog AI..."
cd backend && node server.js &
cd frontend && npm start
______________________________________________________________________________________________________________________________________________________________________________

Usage Guide
1. Upload a LAS File
Click "Choose LAS File" button
Select your .las file
Wait for upload progress to complete
Success message will appear

2. Select a File
From the "Files" dropdown, select your uploaded file
Available curves will load automatically

3. Visualize Curves
Select one or more curves from the multi-select dropdown
Adjust depth range (min/max)
Click "Load Data" to display the chart
Use the brush tool at the bottom to zoom

4. Run AI Analysis
Select curves of interest
Click "AI Analyze" to get:
Statistical summaries
Anomaly detection
Trend analysis

5. Use the Chatbot Assistant
Click "Show Assistant" button
Ask questions like:
"What curves are available?"
"Find hydrocarbon zones"
"Tell me about HC5"
"What is the depth range?"
"Show me anomalies"

______________________________________________________________________________________________________________________________________________________________________________

Images - 


<img width="1467" height="878" alt="Screenshot 2026-02-17 at 22 06 08" src="https://github.com/user-attachments/assets/2877c697-1fb8-406e-b782-918800c4541d" />


<img width="1470" height="872" alt="Screenshot 2026-02-17 at 22 06 34" src="https://github.com/user-attachments/assets/578e6b4f-51f1-4af8-af3d-3972e81f1ec0" />


<img width="408" height="836" alt="Screenshot 2026-02-17 at 22 07 05" src="https://github.com/user-attachments/assets/f6a8843a-e331-42a0-8124-1f637cbf01d0" />
<img width="1466" height="878" alt="Screenshot 2026-02-17 at 22 07 53" src="https://github.com/user-attachments/assets/0128123f-0276-4cf8-9e8e-d76d67e5b257" />
<img width="1470" height="505" alt="Screenshot 2026-02-17 at 22 09 38" src="https://github.com/user-attachments/assets/7379faba-d6b4-4ec5-834a-6fa162578c27" />
<img width="1460" height="819" alt="Screenshot 2026-02-17 at 22 11 13" src="https://github.com/user-attachments/assets/9f1856d2-15d2-4d31-bcff-e6ed1bec3ead" />

