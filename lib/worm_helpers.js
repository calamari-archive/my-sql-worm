



module.exports = {
  /**
   * Converts a dateobject to a datetime string representation
   * @param {Date} data The dateobject
   * @returns {String} A DateTime string
   */
  dateToDateTime: function(date) {
    if (!date || date.constructor !== Date) {
      return '1970-00-00 00:00:00';
    }
    return [date.getFullYear(),
      (date.getMonth() < 9 ? '0' : '') + (date.getMonth()+1),
      (date.getDate() < 10 ? '0' : '') + (date.getDate())
    ].join('-') + ' ' + date.toLocaleTimeString();
  },

  /**
   * Converts a datetime string to a dateobject representation
   * @param {String} A DateTime string
   * @returns {Date} data The dateobject
   */
  dateTimeToDate: function(datetime) {
  return datetime;
    var split = datetime.split(' '),
        d     = split[0].split('-'),
        t     = split[1].split(':');
    return new Date(d[0], ~~d[1]-1, d[2], t[0], t[1], t[2]);
  }
};
