"use client";
import React from "react";

export default function DataUploadForm() {
  const handleOpenForm = () => {
    //Data upload link
    window.open(
      "https://forms.gle/xqVt2t6tLzj1L2p6A",
      "_blank"
    );
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
        When you submit this form, the owner will see your name and email
        address.
        <br />
        <span className="text-yellow-600 font-semibold">
          Please note: It will take around 5 hours to process in our backend
          system.
        </span>
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
