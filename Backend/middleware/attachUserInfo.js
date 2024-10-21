const attachUserInfo = (req, res, next) => {
    if (req.ntlm) {
        req.AdminID = req.ntlm.UserName; // Ensure AdminID is attached to the request
        req.AdminComputer = req.ntlm.Workstation; // Attach AdminComputer to the request
    }
    next();
};

module.exports = attachUserInfo;