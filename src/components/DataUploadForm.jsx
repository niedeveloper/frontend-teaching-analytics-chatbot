"use client";
import React, { useState } from "react";
import FileUploadModal from "./FileUploadModal";
import { useUser } from "../context/UserContext";

export default function DataUploadForm() {
  const { user } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    if (!user?.email) {
      // Show error or redirect to login
      return;
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
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
          <span className="text-yellow-600 font-semibold">
            Please note: It will take around 5 hours to process in our backend
            system.
          </span>
        </p>
        {user?.email ? (
          <button
            onClick={handleOpenModal}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition"
          >
            Upload Lesson Audio
          </button>
        ) : (
          <div className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl">
            Please log in to upload files
          </div>
        )}
      </div>

      {user?.email && (
        <FileUploadModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
        />
      )}
    </>
  );
}
