const log = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(message, ...optionalParams);
    }
};

const info = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        console.info(message, ...optionalParams);
    }
};

const warn = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        console.warn(message, ...optionalParams);
    }
};

const error = (message, ...optionalParams) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error(message, ...optionalParams);
    }
};

module.exports = {
    log,
    info,
    warn,
    error
};