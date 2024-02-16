import { Canister, query, ic, update, text, Record, Principal, Opt, nat64, bool, blob, Result, Vec, StableBTreeMap } from 'azle';
import { v4 as uuidv4 } from "uuid";


const license = Record({
    licenseId: text,
    name: text,
    serialNumber: text,
    expired: Opt(nat64),
    isUsed: bool,
    createdAt: nat64,
});

const course = Record({
    id: text,
    name: text,
    principal: Principal,
    licenses: Vec(license),
    createdAt: nat64,
});

const licensePayload = Record({
    courseId: text,
    name: text,
    serialNumber: text,
    expired: Opt(nat64),
});


const checkLicensePayload = Record({
    courseId: text,
    serialNumber: text,
});

const redeemCourseLicensePayload = Record({
    courseId: text,
    serialNumber: text,
});

type Course = typeof course.tsType;
type License = typeof license.tsType;

let courseInstitution = StableBTreeMap<text, Course>(2);

export default Canister({

    createCourse: update([text], Result(course, text), (name) => {
        try {
            const courseId = uuidv4();
            const newCourse: Course = {
                id: courseId,
                name: name,
                principal: ic.caller(),
                licenses: [],
                createdAt: ic.time(),
            };

            courseInstitution.insert(courseId, newCourse);
              return Result.Ok(newCourse);
        } catch(err) {
            return Result.Err("Error While registering license [" + err +"]");
        }
    }),

    getCourses: query([], Result(Vec(course), text), () => {
        const courses = courseInstitution.values();
        if (courses.length === 0) {
            return Result.Err('Course is Empty')
        }
        return Result.Ok(courses)
    }),

    createLicense: update([licensePayload], Result(license, text), (payload) => {
        try {
            // Check if course is exist
            const courseOpt = courseInstitution.get(payload.courseId);

            if ('None' in courseOpt) {
                return Result.Err("Course not found.");
            }

            const course = courseOpt.Some;

            // Check if caller is principal of course
            if(ic.caller().toString() !== course.principal.toString()) {
                return Result.Err("You dont have permission to this course license");
            }
            
            // Check if license is duplicate
            const duplicatedLicense = course.licenses.find((course) => course.serialNumber === payload.serialNumber);
            if(duplicatedLicense) {
                return Result.Err("Your license serial number already created before");
            }

            const newLicense: License = {
                licenseId: uuidv4(),
                name: payload.name,
                serialNumber: payload.serialNumber,
                expired: payload.expired,
                isUsed: false,
                createdAt: ic.time(),
            };

            const newCourse: Course = {
                ...course,
                licenses: [...course.licenses, newLicense],
            }
            
            courseInstitution.insert(newCourse.id, newCourse);
            return Result.Ok(newLicense);
        } catch(err) {
            return Result.Err("Error While registering license [" + err +"]");
        }
    }),

    checkLicense: query([checkLicensePayload], Result(bool, text), (payload) => {
        // Check if course is exist
        const courseOpt = courseInstitution.get(payload.courseId);

        if ('None' in courseOpt) {
            return Result.Err("course not found.");
        }

        const course = courseOpt.Some;

        // Check if license is exists
        const license = course.licenses.find((license) => license.serialNumber === payload.serialNumber);
        if(!license) {
            return Result.Ok(false);
        }

        // Check if license is already expired or valid
        if('None' in license.expired) {
            return Result.Ok(true);
        } else {
            return Result.Ok(false);
        }
    }),

    redeemCourseLicense: update([redeemCourseLicensePayload], Result(license, text), (payload) => {
        // Check if course is exist
        const courseOpt = courseInstitution.get(payload.courseId);

        if ('None' in courseOpt) {
            return Result.Err("Software not found.");
        }

        const course = courseOpt.Some;

        // Check if license is valid
        const license = course.licenses.find((license) => license.serialNumber === payload.serialNumber);
        if(license && !license.isUsed) {

            const newLicense: License = {
                ...license,
                isUsed: true,
            }

            const newCourse: Course = {
                ...course,
                licenses: [...course.licenses, newLicense],
            }

            courseInstitution.insert(newCourse.id, newCourse);
            return Result.Ok(newLicense);
        }

        return Result.Err(`Serial number is invalid on ${course.name}`);
    }),


})