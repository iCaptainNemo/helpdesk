const attachUserInfo = (req, res, next) => {
    if (req.ntlm) {
        req.AdminID = req.ntlm.UserName; // Ensure AdminID is attached to the request
        req.computerName = req.ntlm.Workstation;
    }
    next();
};

module.exports = attachUserInfo;