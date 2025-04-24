import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export const useEscalations = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "escalations"));
      const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(results);
      setLoading(false);
    };

    fetchData();
  }, []);

  return { data, loading };
};
