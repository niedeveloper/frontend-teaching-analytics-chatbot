import { Folder, Bot, Check } from "lucide-react";

export default function ClassFileTable({
  filterClass,
  setFilterClass,
  selectedFiles,
  setSelectedFiles,
  filteredTableData,
  tableLoading,
  handleFileSelection,
  handleGoToChatbot,
}) {
  const handleSelectAll = (e) => {
    const allIds = filteredTableData.flatMap(
      (item) => item.files?.map((file) => file.file_id) || []
    );
    setSelectedFiles(e.target.checked ? allIds : []);
  };

  const handleClassSelectAll = (item, e) => {
    const fileIds = item.files?.map((file) => file.file_id) || [];
    setSelectedFiles((prev) =>
      e.target.checked
        ? [...prev, ...fileIds]
        : prev.filter((id) => !fileIds.includes(id))
    );
  };

  return (
    <section className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/40 p-2 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Folder className="text-blue-600 dark:text-blue-400 w-8 h-8" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Your uploaded class lessons
        </h3>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Filter by class name..."
          className="border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 w-full md:w-1/3 focus:ring focus:ring-blue-200 dark:focus:ring-blue-700"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        />
        <button
          className={`flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-full font-semibold hover:scale-105 hover:bg-indigo-700 shadow transition
            ${selectedFiles.length === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={handleGoToChatbot}
          disabled={selectedFiles.length === 0}
        >
          <Bot className="w-4 h-4" />
          Chatbot ({selectedFiles.length})
        </button>
      </div>

      <div className="overflow-x-auto">
        {tableLoading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading files...</div>
        ) : (
          <>
            {/* Desktop Table */}
            <table className="min-w-full text-sm hidden md:table rounded-xl overflow-hidden">
              <thead className="bg-blue-50 dark:bg-blue-900/30">
                <tr>
                  <th className="p-2">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        selectedFiles.length > 0 &&
                        selectedFiles.length ===
                          filteredTableData.flatMap((item) =>
                            item.files?.map((file) => file.file_id)
                          ).length
                      }
                      aria-label="Select all files"
                      className="accent-blue-600"
                    />
                  </th>
                  <th className="text-left p-2 text-gray-700 dark:text-gray-300">Class</th>
                  <th className="text-left p-2 text-gray-700 dark:text-gray-300">Files</th>
                  <th className="text-center p-2 text-gray-700 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 dark:text-gray-500 py-4">
                      No classes found.
                    </td>
                  </tr>
                ) : (
                  filteredTableData.map((item) => (
                    <tr
                      key={item.class_id}
                      className="border-b border-gray-100 dark:border-gray-700 even:bg-blue-50 dark:even:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition text-gray-800 dark:text-gray-200"
                    >
                      <td className="p-2 align-top">
                        <input
                          type="checkbox"
                          checked={item.files?.every((file) =>
                            selectedFiles.includes(file.file_id)
                          )}
                          onChange={(e) => handleClassSelectAll(item, e)}
                          aria-label={`Select all files for ${item.class_name}`}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="p-2 font-medium">{item.class_name}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-2">
                          {item.files?.map((file) => (
                            <label
                              key={file.file_id}
                              className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFiles.includes(file.file_id)}
                                onChange={(e) =>
                                  handleFileSelection(file.file_id, e.target.checked)
                                }
                                aria-label={`Select file ${file.stored_filename}`}
                                className="accent-blue-600"
                              />
                              {file.stored_filename}
                            </label>
                          )) || <span className="text-gray-400 dark:text-gray-500">No files</span>}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => {
                            const fileIds = item.files?.map((file) => file.file_id) || [];
                            if (fileIds.length > 0) setSelectedFiles(fileIds);
                          }}
                          className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white shadow transition"
                          aria-label={`Select all files for ${item.class_name}`}
                        >
                          <Check className="w-3 h-3 inline mr-1" />
                          Select All
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile card view */}
            <div className="flex flex-col gap-4 md:hidden">
              {filteredTableData.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-gray-500 py-6">
                  No classes found.
                </div>
              ) : (
                filteredTableData.map((item) => (
                  <div
                    key={item.class_id}
                    className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 shadow flex flex-col gap-2 border border-blue-100 dark:border-blue-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-800 dark:text-gray-100">{item.class_name}</div>
                      <button
                        onClick={() => {
                          const fileIds = item.files?.map((file) => file.file_id) || [];
                          if (fileIds.length > 0) setSelectedFiles(fileIds);
                        }}
                        className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition"
                        aria-label={`Select all files for ${item.class_name}`}
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        Select All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.files?.map((file) => (
                        <label
                          key={file.file_id}
                          className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.file_id)}
                            onChange={(e) =>
                              handleFileSelection(file.file_id, e.target.checked)
                            }
                            aria-label={`Select file ${file.stored_filename}`}
                            className="accent-blue-600"
                          />
                          {file.stored_filename}
                        </label>
                      )) || <span className="text-gray-400 dark:text-gray-500">No files</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
