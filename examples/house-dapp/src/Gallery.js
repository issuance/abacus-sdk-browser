import React from "react";
import "./App.css";

class Gallery extends React.Component {
  render() {
    return (
      <div className="gallery">
        {[...Array(10)].map((x, i) => (
          <div className="item" key={i}>
            <div className="img">
              <img src="" />
              <span>$1000</span>
            </div>
            <h1>Test House</h1>
          </div>
        ))}
      </div>
    );
  }
}

export default Gallery;