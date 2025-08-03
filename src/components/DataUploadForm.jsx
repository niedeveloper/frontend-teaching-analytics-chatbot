"use client";
import React from "react";

export default function DataUploadForm() {
  const handleOpenForm = () => {
    // Replace the URL below with your actual Microsoft Form link
    window.open("https://forms.gle/jdX5WgoBNLPCj6ec6", "_blank");
  };

  return (
    <div className="bg-white shadow-md rounded-xl p-6 text-center space-y-4">
      <h2 className="text-xl font-semibold text-indigo-700">
        Teacher's Analytics Data Upload
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed">
        Upload the details and audio file of your lesson here. It is recommended
        to name your file:
        <span className="font-medium">
          "[Subject]_[Class]_[Date of lesson].mp3"
        </span>
        <br />
        Hi, Alyssa. When you submit this form, the owner will see your name and
        email address.
      </p>
      <button
        onClick={handleOpenForm}
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition"
      >
        Open Data Upload Form
      </button>
    </div>
  );
}
