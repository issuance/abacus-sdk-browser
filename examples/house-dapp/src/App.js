import React from "react";
import "./App.css";
import Gallery from "./Gallery";

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <div className="header">
          <h1 className="title">House Marketplace DApp</h1>
          <button className="login">Log in</button>
        </div>
        <Gallery />
      </div>
    );
  }
}

export default App;
