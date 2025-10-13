/**
 * Salary Comparator Utility
 * Normalizes salary data and compares against minimum requirements
 */

class SalaryComparator {
  /**
   * Parse salary string and extract min/max values
   * Examples: "$120k-$150k/year", "$100,000 annually", "$50-60/hour", "120k", "Not specified"
   */
  parseSalary(salaryStr) {
    if (!salaryStr || 
        salaryStr.toLowerCase().includes('not specified') || 
        salaryStr.toLowerCase().includes('competitive') ||
        salaryStr.toLowerCase().includes('n/a') ||
        salaryStr.trim() === '') {
      return { notSpecified: true };
    }

    const str = salaryStr.toLowerCase().replace(/,/g, '');
    
    // Detect salary type
    const isHourly = /hour|hr|\/h\b/.test(str);
    const isMonthly = /month|monthly|\/m\b/.test(str);
    const isAnnual = /year|annual|yearly|\/y\b|k\b/.test(str) || (!isHourly && !isMonthly);
    
    // Extract numbers
    const numbers = str.match(/\d+(\.\d+)?/g);
    if (!numbers || numbers.length === 0) {
      return { notSpecified: true };
    }
    
    // Parse numbers (handle 'k' notation)
    let parsedNumbers = numbers.map(num => {
      const value = parseFloat(num);
      // If value is small (< 1000) and has 'k' nearby, multiply by 1000
      if (value < 1000 && /\d+k/.test(str)) {
        return value * 1000;
      }
      return value;
    });
    
    // Get min and max
    const minSalary = Math.min(...parsedNumbers);
    const maxSalary = Math.max(...parsedNumbers);
    
    return {
      notSpecified: false,
      min: minSalary,
      max: maxSalary,
      isHourly,
      isMonthly,
      isAnnual,
      originalText: salaryStr
    };
  }
  
  /**
   * Normalize salary to annual equivalent
   */
  normalizeToAnnual(salaryData) {
    if (salaryData.notSpecified) {
      return null;
    }
    
    let annualMin = salaryData.min;
    let annualMax = salaryData.max;
    
    if (salaryData.isHourly) {
      // Assume 40 hours/week, 52 weeks/year = 2080 hours/year
      annualMin = salaryData.min * 2080;
      annualMax = salaryData.max * 2080;
    } else if (salaryData.isMonthly) {
      // 12 months in a year
      annualMin = salaryData.min * 12;
      annualMax = salaryData.max * 12;
    }
    
    return {
      min: Math.round(annualMin),
      max: Math.round(annualMax),
      average: Math.round((annualMin + annualMax) / 2)
    };
  }
  
  /**
   * Compare job salary against user's minimum requirements
   * @param {string} jobSalary - Salary string from job posting
   * @param {object} minRequirements - User's minimum salary requirements {annual, monthly, hourly}
   * @returns {object} - {meetsRequirement: boolean, reason: string, jobSalaryAnnual: number|null}
   */
  compareToMinimum(jobSalary, minRequirements) {
    const parsed = this.parseSalary(jobSalary);
    
    // If salary not specified, always accept
    if (parsed.notSpecified) {
      return {
        meetsRequirement: true,
        reason: 'Salary not specified - accepting job',
        jobSalaryAnnual: null
      };
    }
    
    const normalized = this.normalizeToAnnual(parsed);
    if (!normalized) {
      return {
        meetsRequirement: true,
        reason: 'Could not parse salary - accepting job',
        jobSalaryAnnual: null
      };
    }
    
    // Get user's minimum (prioritize annual, then monthly, then hourly)
    let userMinAnnual = 0;
    
    if (minRequirements.annual && minRequirements.annual > 0) {
      userMinAnnual = parseInt(minRequirements.annual);
    } else if (minRequirements.monthly && minRequirements.monthly > 0) {
      userMinAnnual = parseInt(minRequirements.monthly) * 12;
    } else if (minRequirements.hourly && minRequirements.hourly > 0) {
      userMinAnnual = parseInt(minRequirements.hourly) * 2080;
    } else {
      // No minimum set, accept all
      return {
        meetsRequirement: true,
        reason: 'No minimum salary configured - accepting job',
        jobSalaryAnnual: normalized.average
      };
    }
    
    // Compare job's MAXIMUM salary against user's minimum
    // (Give job the benefit of the doubt by using max of range)
    const meetsRequirement = normalized.max >= userMinAnnual;
    
    return {
      meetsRequirement,
      reason: meetsRequirement 
        ? `Job max salary $${normalized.max.toLocaleString()} >= minimum $${userMinAnnual.toLocaleString()}`
        : `Job max salary $${normalized.max.toLocaleString()} < minimum $${userMinAnnual.toLocaleString()}`,
      jobSalaryAnnual: normalized.average,
      jobSalaryMin: normalized.min,
      jobSalaryMax: normalized.max,
      userMinimum: userMinAnnual
    };
  }
}

module.exports = new SalaryComparator();

