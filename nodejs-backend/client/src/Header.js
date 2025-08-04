import React from "react";
import { Link } from 'react-router-dom';
import "./App.css"; // 또는 MainPage.css

const Header = () => {
    return (
        <div>
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
            />
            <header className="app-header">
                <Link to="http://15.168.150.125:5000/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="logo">
                        <i className="fas fa-leaf"></i>
                        <span>PlantMate</span>
                    </div>
                </Link>

                <nav className="main-nav">
                    <a href="/home" className="nav-link active">홈</a>
                    <a href="http://15.168.150.125:5000/plantgrowthtracker" className="nav-link">식물 성장</a>
                    <a href="http://13.208.122.37:3000/" className="nav-link">정원 꾸미기</a>
                    <a href="/plantrecommend" className="nav-link">식물 추천</a>
                </nav>
            </header>
        </div>
    );
};

export default Header;
