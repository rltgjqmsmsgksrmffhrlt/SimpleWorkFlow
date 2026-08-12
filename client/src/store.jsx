import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import { playBell } from "./sound";

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  const [connected, setConnected] = useState(socket.connected);
  const [teams, setTeams] = useState([]);
  const [goal, setGoalState] = useState({ content: "", updatedBy: "", updatedAt: null, date: "" });
  const [tasks, setTasks] = useState([]);
  const [collabRequests, setCollabRequests] = useState([]);

  const [myTeam, setMyTeamState] = useState(() => localStorage.getItem("swf_myTeam") || "");
  const [myName, setMyNameState] = useState(() => localStorage.getItem("swf_myName") || "");

  const myTeamRef = useRef(myTeam);
  useEffect(() => {
    myTeamRef.current = myTeam;
  }, [myTeam]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teams")
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled && Array.isArray(list) && list.length) setTeams(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onInit(state) {
      setTeams(state.teams || []);
      setGoalState(state.goal || {});
      setTasks(state.tasks || []);
      setCollabRequests(state.collabRequests || []);
    }
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onGoalUpdate(g) {
      setGoalState(g);
    }
    function onTaskCreate(t) {
      setTasks((prev) => [...prev, t]);
    }
    function onTaskUpdate(t) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    }
    function onTaskDelete({ id }) {
      setTasks((prev) => prev.filter((x) => x.id !== id));
    }
    function onCollabCreate(r) {
      setCollabRequests((prev) => [...prev, r]);
      if (r.toTeam === myTeamRef.current) playBell();
    }
    function onCollabUpdate(r) {
      setCollabRequests((prev) => prev.map((x) => (x.id === r.id ? r : x)));
    }
    function onCollabDelete({ id }) {
      setCollabRequests((prev) => prev.filter((x) => x.id !== id));
    }
    function onCollabRemind({ toTeam }) {
      if (toTeam === myTeamRef.current) playBell();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state:init", onInit);
    socket.on("goal:update", onGoalUpdate);
    socket.on("task:create", onTaskCreate);
    socket.on("task:update", onTaskUpdate);
    socket.on("task:delete", onTaskDelete);
    socket.on("collab:create", onCollabCreate);
    socket.on("collab:update", onCollabUpdate);
    socket.on("collab:delete", onCollabDelete);
    socket.on("collab:remind", onCollabRemind);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state:init", onInit);
      socket.off("goal:update", onGoalUpdate);
      socket.off("task:create", onTaskCreate);
      socket.off("task:update", onTaskUpdate);
      socket.off("task:delete", onTaskDelete);
      socket.off("collab:create", onCollabCreate);
      socket.off("collab:update", onCollabUpdate);
      socket.off("collab:delete", onCollabDelete);
      socket.off("collab:remind", onCollabRemind);
    };
  }, []);

  const setMyTeam = useCallback((id) => {
    setMyTeamState(id);
    localStorage.setItem("swf_myTeam", id);
  }, []);

  const setMyName = useCallback((name) => {
    setMyNameState(name);
    localStorage.setItem("swf_myName", name);
  }, []);

  const teamName = useCallback(
    (id) => teams.find((t) => t.id === id)?.name || id,
    [teams]
  );

  const whoAmI = useMemo(() => {
    const label = myName?.trim() ? myName.trim() : "";
    const team = myTeam ? teamName(myTeam) : "";
    if (label && team) return `${label} (${team})`;
    return label || team || "익명";
  }, [myName, myTeam, teamName]);

  const actions = useMemo(
    () => ({
      setGoal: (content) => socket.emit("goal:set", { content, updatedBy: whoAmI }),
      createTask: (teamId, time, endTime, title, memo) =>
        socket.emit("task:create", { teamId, time, endTime, title, memo }),
      updateTask: (id, patch) => socket.emit("task:update", { id, patch }),
      deleteTask: (id) => socket.emit("task:delete", { id }),
      createCollab: (fromTeam, toTeam, meetingTime, agenda) =>
        socket.emit("collab:create", { fromTeam, toTeam, meetingTime, agenda, requestedBy: whoAmI }),
      updateCollab: (id, patch) => socket.emit("collab:update", { id, patch }),
      deleteCollab: (id) => socket.emit("collab:delete", { id }),
      remindCollab: (id) => socket.emit("collab:remind", { id }),
    }),
    [whoAmI]
  );

  const value = {
    connected,
    teams,
    goal,
    tasks,
    collabRequests,
    myTeam,
    myName,
    setMyTeam,
    setMyName,
    teamName,
    whoAmI,
    ...actions,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used within WorkflowProvider");
  return ctx;
}
