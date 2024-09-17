// src/utils/userData.js
export const initializeUserData = () => {
    const existingData = localStorage.getItem("users");
  
    if (!existingData) {
      const userData = {
        admin: { password: "0000", role: "admin" },
       
      };
      localStorage.setItem("users", JSON.stringify(userData));
    }
  };
  
  export const getUserData = () => {
    return JSON.parse(localStorage.getItem("users"));
  };
  
  export const updateUserData = (username, newPassword) => {
    const users = getUserData();
    if (users[username]) {
      users[username].password = newPassword;
      localStorage.setItem("users", JSON.stringify(users));
    }
  };
  