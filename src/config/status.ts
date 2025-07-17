const getUserStatusColor = (status: UserStatus) => {
  switch (status) {
    case "ACTIVE":
      return "bg-[#E2FFE8] text-[#13E741]";
    case "FLAGGED":
      return "bg-[#FFEBEB] text-[#FF4141]";
    case "INACTIVE":
      return "bg-[#F5F5F5] text-[#999999]";
  }
};

const getUserStatusText = (status: UserStatus) => {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "FLAGGED":
      return "Suspended";
    case "INACTIVE":
      return "Inactive";
  }
};

export { getUserStatusColor, getUserStatusText };
